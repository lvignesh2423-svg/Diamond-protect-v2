import threading
import time
from typing import Any, Dict, List, Optional

import networkx as nx

from backend.core.db_engine import get_all_transactions_df

CYCLE_MAX_LENGTH = 6
CYCLE_TIME_BUDGET_SEC = 0.75
MAX_VISUAL_NODES = 60


class MuleGraphEngine:
    """
    Directed money-flow graph over the transaction ledger.

    Performance contract:
      * cluster / visualisation payloads are always served from cache (instant);
      * a rebuild is triggered in the background, never inline on a request path;
      * cycle enumeration is bounded by SCC pruning + length bound + wall-clock budget
        so a large ledger can never hang the UI.
    """

    def __init__(self, preload: bool = True):
        self.graph = nx.DiGraph()
        self.cached_clusters: Dict[str, Any] = {
            "hub_mules": [], "circular_chains": [], "total_nodes": 0, "total_edges": 0,
            "cycle_search": {"bounded_length": CYCLE_MAX_LENGTH, "truncated": False, "elapsed_ms": 0},
        }
        self.cached_visualization: Dict[str, Any] = {"nodes": [], "edges": []}
        self.degree_distribution: List[Dict[str, Any]] = []
        self._lock = threading.RLock()
        self._thread: Optional[threading.Thread] = None
        self._dirty = True
        self._last_build_ms = 0
        if preload:
            self.reload_graph()

    # ------------------------------------------------------------------ rebuild
    def reload_graph(self) -> None:
        started = time.perf_counter()
        try:
            df = get_all_transactions_df()
        except Exception as exc:
            print(f"[graph] failed to read ledger: {exc}")
            return

        graph = nx.DiGraph()
        if not df.empty:
            edge_agg = df.groupby(["sender_id", "receiver_id"]).agg(
                weight=("amount", "sum"),
                count=("amount", "count"),
                fraud_count=("is_fraud", "sum"),
            ).reset_index()
            for _, row in edge_agg.iterrows():
                graph.add_edge(
                    str(row["sender_id"]),
                    str(row["receiver_id"]),
                    weight=float(row["weight"]),
                    count=int(row["count"]),
                    fraud_count=int(row["fraud_count"]),
                )

        clusters, visualization, degree_dist = self._compute_caches(graph)
        elapsed_ms = round((time.perf_counter() - started) * 1000, 1)

        with self._lock:
            self.graph = graph
            self.cached_clusters = clusters
            self.cached_visualization = visualization
            self.degree_distribution = degree_dist
            self._dirty = False
            self._last_build_ms = elapsed_ms
        print(f"[graph] rebuilt in {elapsed_ms}ms - {clusters['total_nodes']} nodes / {clusters['total_edges']} edges")

    def schedule_reload(self) -> None:
        """Debounced background rebuild so API responses never wait on graph work."""
        with self._lock:
            if self._thread is not None and self._thread.is_alive():
                return
            self._thread = threading.Thread(target=self._safe_reload, name="mule-graph-reload", daemon=True)
            self._thread.start()

    def _safe_reload(self):
        try:
            self.reload_graph()
        except Exception as exc:  # pragma: no cover - defensive
            print(f"[graph] background reload failed: {exc}")

    # ------------------------------------------------------------------ caches
    def _compute_caches(self, graph: nx.DiGraph):
        hub_mules: List[Dict[str, Any]] = []
        circular_chains: List[Dict[str, Any]] = []

        if graph.number_of_nodes() == 0:
            return (
                {
                    "hub_mules": [], "circular_chains": [], "total_nodes": 0, "total_edges": 0,
                    "cycle_search": {"bounded_length": CYCLE_MAX_LENGTH, "truncated": False, "elapsed_ms": 0},
                },
                {"nodes": [], "edges": []},
                [],
            )

        in_degrees = dict(graph.in_degree())
        out_degrees = dict(graph.out_degree())

        for node in graph.nodes():
            in_d = in_degrees.get(node, 0)
            out_d = out_degrees.get(node, 0)
            if in_d >= 3:
                total_in = sum(graph[pred][node]["weight"] for pred in graph.predecessors(node))
                total_out = sum(graph[node][succ]["weight"] for succ in graph.successors(node))
                drain = (total_out / total_in) if total_in > 0 else 0
                hub_mules.append({
                    "node": node,
                    "in_degree": int(in_d),
                    "out_degree": int(out_d),
                    "total_inflow": round(total_in, 2),
                    "total_outflow": round(total_out, 2),
                    "drain_ratio": round(drain, 2),
                    "role": "HUB_MULE" if drain > 0.6 else "HIGH_INFLOW_BENEFICIARY",
                    "fraud_share": round(
                        (sum(graph[pred][node]["fraud_count"] for pred in graph.predecessors(node))
                         / max(sum(graph[pred][node]["count"] for pred in graph.predecessors(node)), 1)), 3
                    ),
                })

        circular_chains, cycle_meta = self._find_cycles(graph)

        degree_dist = sorted(
            (
                {
                    "node": n,
                    "in_degree": int(in_degrees.get(n, 0)),
                    "out_degree": int(out_degrees.get(n, 0)),
                    "total": int(in_degrees.get(n, 0) + out_degrees.get(n, 0)),
                }
                for n in graph.nodes()
            ),
            key=lambda x: x["total"],
            reverse=True,
        )[:15]

        display_nodes = self._display_nodes(graph, hub_mules)
        sub = graph.subgraph(display_nodes)

        nodes_list = []
        for n in sub.nodes():
            name = str(n)
            is_hub = "HUB" in name or any(h["node"] == n for h in hub_mules[:5])
            is_mule = "MULE" in name or "SCAMMER" in name or "fastcash" in name
            is_merchant = "Store" in name or "Point" in name or "Digital" in name or "Pharmacy" in name
            nodes_list.append({
                "id": n,
                "label": n,
                "type": "HUB_MULE" if is_hub else ("MULE_ACCOUNT" if is_mule else ("MERCHANT" if is_merchant else "USER")),
                "in_degree": int(graph.in_degree(n)),
                "out_degree": int(graph.out_degree(n)),
                "inflow": round(sum(d["weight"] for _, _, d in graph.in_edges(n, data=True)), 2),
                "outflow": round(sum(d["weight"] for _, _, d in graph.out_edges(n, data=True)), 2),
            })

        edges_list = [
            {
                "source": u,
                "target": v,
                "amount": round(data.get("weight", 0), 2),
                "count": data.get("count", 1),
                "is_fraud": data.get("fraud_count", 0) > 0,
            }
            for u, v, data in sub.edges(data=True)
        ]

        clusters = {
            "hub_mules": sorted(hub_mules, key=lambda x: x["in_degree"], reverse=True)[:15],
            "circular_chains": circular_chains[:8],
            "total_nodes": graph.number_of_nodes(),
            "total_edges": graph.number_of_edges(),
            "cycle_search": cycle_meta,
        }
        return clusters, {"nodes": nodes_list, "edges": edges_list}, degree_dist

    @staticmethod
    def _display_nodes(graph: nx.DiGraph, hub_mules: List[Dict[str, Any]]) -> List[Any]:
        flagged = [h["node"] for h in hub_mules]
        names = [n for n in graph.nodes() if "MULE" in str(n) or "SCAMMER" in str(n) or "fastcash" in str(n)]
        degrees = dict(graph.degree())
        top = sorted(degrees.keys(), key=lambda n: degrees[n], reverse=True)[:40]
        ordered: List[Any] = []
        for node in flagged + names + top:
            if node in graph and node not in ordered:
                ordered.append(node)
            if len(ordered) >= MAX_VISUAL_NODES:
                break
        return ordered

    @staticmethod
    def _find_cycles(graph: nx.DiGraph):
        """
        Cycle discovery that is safe on large graphs:
          1. keep only nodes that sit inside a non-trivial strongly connected component
          2. bound cycle length (length_bound) - wash rings are 3-6 nodes
          3. enforce a wall-clock budget
        """
        started = time.perf_counter()
        truncated = False
        scc_count = 0
        chains: List[Dict[str, Any]] = []
        try:
            scc_nodes = [comp for comp in nx.strongly_connected_components(graph) if len(comp) >= 2]
            scc_count = len(scc_nodes)
            if not scc_nodes:
                return chains, {
                    "bounded_length": CYCLE_MAX_LENGTH,
                    "truncated": False,
                    "elapsed_ms": round((time.perf_counter() - started) * 1000, 1),
                    "scc_count": 0,
                }
            sub = graph.subgraph([n for comp in scc_nodes for n in comp])
            iterator = nx.simple_cycles(sub, length_bound=CYCLE_MAX_LENGTH)
            seen = set()
            while len(chains) < 12:
                if time.perf_counter() - started > CYCLE_TIME_BUDGET_SEC:
                    truncated = True
                    break
                cycle = next(iterator, None)
                if cycle is None:
                    break
                key = tuple(sorted(cycle))
                if key in seen:
                    continue
                seen.add(key)
                if 3 <= len(cycle) <= CYCLE_MAX_LENGTH:
                    chains.append({"nodes": [str(n) for n in cycle], "length": len(cycle), "type": "CIRCULAR_WASH_RING"})
        except Exception as exc:
            print(f"[graph] cycle search stopped: {exc}")
            truncated = True

        return chains, {
            "bounded_length": CYCLE_MAX_LENGTH,
            "truncated": truncated,
            "elapsed_ms": round((time.perf_counter() - started) * 1000, 1),
            "scc_count": scc_count,
        }

    # ------------------------------------------------------------------ accessors
    def detect_mule_rings(self) -> Dict[str, Any]:
        with self._lock:
            data = self.cached_clusters
        if self._dirty:
            self.schedule_reload()
        return data

    def get_network_visualization_data(self, limit_nodes: int = 40) -> Dict[str, Any]:
        with self._lock:
            nodes = list(self.cached_visualization.get("nodes", []))
            edges = list(self.cached_visualization.get("edges", []))
        if self._dirty:
            self.schedule_reload()

        limit = max(1, min(int(limit_nodes or 40), MAX_VISUAL_NODES))
        if len(nodes) > limit:
            top = sorted(nodes, key=lambda n: n["in_degree"] + n["out_degree"], reverse=True)[:limit]
            keep = {n["id"] for n in top}
            nodes = top
            edges = [e for e in edges if e["source"] in keep and e["target"] in keep]
        return {"nodes": nodes, "edges": edges}

    def get_degree_distribution(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self.degree_distribution)

    @property
    def last_build_ms(self) -> float:
        return self._last_build_ms

    @property
    def is_stale(self) -> bool:
        return self._dirty

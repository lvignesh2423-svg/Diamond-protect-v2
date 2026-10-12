import networkx as nx
import pandas as pd
from backend.core.db_engine import get_all_transactions_df

class MuleGraphEngine:
    def __init__(self):
        self.graph = nx.DiGraph()
        self.cached_clusters = None
        self.cached_visualization = None
        self.reload_graph()

    def reload_graph(self):
        """Fast index build from DB with precomputed clusters to prevent UI lag."""
        self.graph.clear()
        try:
            df = get_all_transactions_df()
            if df.empty:
                self.cached_clusters = {"hub_mules": [], "circular_chains": [], "total_nodes": 0, "total_edges": 0}
                self.cached_visualization = {"nodes": [], "edges": []}
                return

            # Fast vectorized edge aggregation
            edge_agg = df.groupby(["sender_id", "receiver_id"]).agg(
                weight=("amount", "sum"),
                count=("amount", "count"),
                fraud_count=("is_fraud", "sum")
            ).reset_index()

            for _, row in edge_agg.iterrows():
                self.graph.add_edge(
                    str(row["sender_id"]),
                    str(row["receiver_id"]),
                    weight=float(row["weight"]),
                    count=int(row["count"]),
                    fraud_count=int(row["fraud_count"])
                )

            # Precalculate metrics immediately in memory
            self._compute_cache()
        except Exception as e:
            print(f"Error loading graph: {e}")

    def _compute_cache(self):
        hub_mules = []
        circular_chains = []

        in_degrees = dict(self.graph.in_degree())
        out_degrees = dict(self.graph.out_degree())

        for node in self.graph.nodes():
            in_d = in_degrees.get(node, 0)
            out_d = out_degrees.get(node, 0)

            if in_d >= 3:
                total_in_amt = sum(self.graph[pred][node]["weight"] for pred in self.graph.predecessors(node))
                total_out_amt = sum(self.graph[node][succ]["weight"] for succ in self.graph.successors(node))
                drain_ratio = (total_out_amt / total_in_amt) if total_in_amt > 0 else 0

                hub_mules.append({
                    "node": node,
                    "in_degree": in_d,
                    "out_degree": out_d,
                    "total_inflow": round(total_in_amt, 2),
                    "total_outflow": round(total_out_amt, 2),
                    "drain_ratio": round(drain_ratio, 2),
                    "role": "HUB_MULE" if drain_ratio > 0.6 else "HIGH_INFLOW_BENEFICIARY"
                })

        # Efficient cycle discovery (limit length 2-5, fast cutoff)
        try:
            # Check simple cycles with strict iteration limit
            cycle_iter = nx.simple_cycles(self.graph)
            for _ in range(30):
                c = next(cycle_iter, None)
                if c is None:
                    break
                if 2 <= len(c) <= 6:
                    circular_chains.append({
                        "nodes": c,
                        "length": len(c),
                        "type": "CIRCULAR_WASH_RING"
                    })
        except Exception:
            pass

        self.cached_clusters = {
            "hub_mules": sorted(hub_mules, key=lambda x: x["in_degree"], reverse=True)[:15],
            "circular_chains": circular_chains[:8],
            "total_nodes": self.graph.number_of_nodes(),
            "total_edges": self.graph.number_of_edges()
        }

        # Precompute top visual sub-graph
        limit_nodes = 35
        mule_nodes = [n for n in self.graph.nodes() if "MULE" in n or "SCAMMER" in n or "fastcash" in n]
        degrees = dict(self.graph.degree())
        top_degree_nodes = sorted(degrees.keys(), key=lambda n: degrees[n], reverse=True)[:limit_nodes]

        display_nodes = list(set(mule_nodes + top_degree_nodes))[:40]
        sub = self.graph.subgraph(display_nodes)

        nodes_list = []
        for n in sub.nodes():
            is_mule = "MULE" in n or "SCAMMER" in n or "fastcash" in n
            is_hub = "HUB" in n
            nodes_list.append({
                "id": n,
                "label": n,
                "type": "HUB_MULE" if is_hub else ("MULE_ACCOUNT" if is_mule else ("MERCHANT" if "Store" in n or "Point" in n else "USER")),
                "in_degree": self.graph.in_degree(n),
                "out_degree": self.graph.out_degree(n)
            })

        edges_list = []
        for u, v, data in sub.edges(data=True):
            edges_list.append({
                "source": u,
                "target": v,
                "amount": round(data.get("weight", 0), 2),
                "count": data.get("count", 1),
                "is_fraud": data.get("fraud_count", 0) > 0
            })

        self.cached_visualization = {"nodes": nodes_list, "edges": edges_list}

    def detect_mule_rings(self):
        if not self.cached_clusters:
            self._compute_cache()
        return self.cached_clusters

    def get_network_visualization_data(self, limit_nodes: int = 40):
        if not self.cached_visualization:
            self._compute_cache()
        return self.cached_visualization

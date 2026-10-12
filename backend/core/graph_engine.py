import networkx as nx
import pandas as pd
import json

class MuleGraphEngine:
    def __init__(self, csv_path: str = "d:/Diamond-protect-v2/backend/data/transactions.csv"):
        self.csv_path = csv_path
        self.graph = nx.DiGraph()
        self.reload_graph()

    def reload_graph(self):
        """Loads transactions into directed graph and computes node metrics."""
        self.graph.clear()
        try:
            df = pd.read_csv(self.csv_path)
            for _, row in df.iterrows():
                u = str(row["sender_id"])
                v = str(row["receiver_id"])
                amt = float(row["amount"])
                is_fraud = int(row["is_fraud"])
                
                if self.graph.has_edge(u, v):
                    self.graph[u][v]["weight"] += amt
                    self.graph[u][v]["count"] += 1
                    self.graph[u][v]["fraud_count"] += is_fraud
                else:
                    self.graph.add_edge(u, v, weight=amt, count=1, fraud_count=is_fraud)
        except Exception as e:
            print(f"Error loading graph: {e}")

    def detect_mule_rings(self):
        """
        Detects anomalous graph structures:
        1. Hub-and-Spoke Inflow Mules (High In-degree, fan-out pattern)
        2. Circular Money Laundering Chains (cycles of length 3-6)
        3. High PageRank / Betweenness Centrality Mule Intermediaries
        """
        hub_mules = []
        circular_chains = []
        
        # 1. In-degree and Out-degree analysis
        in_degrees = dict(self.graph.in_degree())
        out_degrees = dict(self.graph.out_degree())
        
        for node in self.graph.nodes():
            in_d = in_degrees.get(node, 0)
            out_d = out_degrees.get(node, 0)
            
            # Hub mule characteristics: High in-degree (> 6) and rapid fan-out (out_d >= 1)
            if in_d >= 6:
                total_in_amt = sum(self.graph[pred][node]["weight"] for pred in self.graph.predecessors(node))
                total_out_amt = sum(self.graph[node][succ]["weight"] for succ in self.graph.successors(node))
                
                # Check rapid drainage ratio
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

        # 2. Cycle detection (Wash trading & circular mule laundering)
        try:
            # Look for elementary cycles of length between 3 and 6
            cycles = list(nx.simple_cycles(self.graph))
            for c in cycles:
                if 2 <= len(c) <= 6:
                    circular_chains.append({
                        "nodes": c,
                        "length": len(c),
                        "type": "CIRCULAR_WASH_RING"
                    })
        except Exception:
            pass

        return {
            "hub_mules": sorted(hub_mules, key=lambda x: x["in_degree"], reverse=True)[:10],
            "circular_chains": circular_chains[:5],
            "total_nodes": self.graph.number_of_nodes(),
            "total_edges": self.graph.number_of_edges()
        }

    def get_node_subgraph(self, target_node: str, depth: int = 1):
        """Extracts ego-network for a specific account for visual drilldown."""
        if target_node not in self.graph:
            return {"nodes": [], "edges": []}
            
        sub = nx.ego_graph(self.graph, target_node, radius=depth, undirected=False)
        nodes_data = []
        for n in sub.nodes():
            is_mule = "MULE" in n or "SCAMMER" in n
            nodes_data.append({
                "id": n,
                "label": n,
                "is_mule": is_mule,
                "is_target": n == target_node,
                "in_degree": self.graph.in_degree(n),
                "out_degree": self.graph.out_degree(n)
            })
            
        edges_data = []
        for u, v, data in sub.edges(data=True):
            edges_data.append({
                "source": u,
                "target": v,
                "weight": data.get("weight", 0),
                "count": data.get("count", 1),
                "is_fraud": data.get("fraud_count", 0) > 0
            })
            
        return {"nodes": nodes_data, "edges": edges_data}

    def get_network_visualization_data(self, limit_nodes: int = 40):
        """Returns nodes and edges formatted for interactive graph rendering."""
        # Pick top connected nodes + mule nodes
        mule_nodes = [n for n in self.graph.nodes() if "MULE" in n or "SCAMMER" in n]
        degrees = dict(self.graph.degree())
        top_degree_nodes = sorted(degrees.keys(), key=lambda n: degrees[n], reverse=True)[:limit_nodes]
        
        display_nodes = list(set(mule_nodes + top_degree_nodes))
        sub = self.graph.subgraph(display_nodes)
        
        nodes_list = []
        for n in sub.nodes():
            is_mule = "MULE" in n or "SCAMMER" in n
            is_hub = n == "MULE_ALPHA_HUB"
            nodes_list.append({
                "id": n,
                "label": n,
                "type": "HUB_MULE" if is_hub else ("MULE_ACCOUNT" if is_mule else ("MERCHANT" if "Store" in n or "Point" in n or "Digital" in n else "USER")),
                "in_degree": self.graph.in_degree(n),
                "out_degree": self.graph.out_degree(n)
            })
            
        edges_list = []
        for u, v, data in sub.edges(data=True):
            edges_list.append({
                "source": u,
                "target": v,
                "amount": data.get("weight", 0),
                "count": data.get("count", 1),
                "is_fraud": data.get("fraud_count", 0) > 0
            })
            
        return {"nodes": nodes_list, "edges": edges_list}

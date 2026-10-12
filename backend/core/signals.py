"""
Derives every behavioural telemetry signal for a live payment from evidence that
actually exists in the deployment:

  * recorded ledger telemetry for the payee VPA (transactions.db)
  * live graph topology for the payee node (NetworkX mule graph)
  * the QR payload itself (cryptographic checks)
  * explicit user input (amount, claimed nameplate, payer reference)

Nothing is invented: a signal that cannot be observed is reported as
`observed=False` and treated as neutral by the rule/ML engines.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.core.db_engine import get_tx_connection

NEUTRAL_TELEMETRY = {
    "beneficiary_age_days": 365,
    "time_since_beneficiary_added_sec": 86400,
    "velocity_10m": 0,
    "outflow_ratio_5m": 0.0,
    "in_degree_1h": 0,
    "ip_risk_score": 0.05,
}


def _parse_ts(value: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(str(value).replace("Z", ""))
    except Exception:
        return None


def _peak_burst(timestamps: List[datetime], window_minutes: int) -> int:
    """Maximum number of records observed inside any single sliding window."""
    if len(timestamps) < 2:
        return len(timestamps)
    ts = sorted(timestamps)
    best = 1
    left = 0
    for right in range(len(ts)):
        while (ts[right] - ts[left]).total_seconds() > window_minutes * 60:
            left += 1
        best = max(best, right - left + 1)
    return best


def ledger_profile(receiver_vpa: str) -> Dict[str, Any]:
    """Aggregated evidence for a payee handle from the transaction ledger."""
    empty = {
        "observed": False,
        "record_count": 0,
        "distinct_senders": 0,
        "total_inflow": 0.0,
        "average_amount": 0.0,
        "fraud_records": 0,
        "fraud_ratio": 0.0,
        "first_seen": None,
        "last_seen": None,
        "receiver_ids": [],
        "top_receiver_id": None,
        "latest": None,
        "timestamps": [],
    }
    if not receiver_vpa:
        return empty

    conn = get_tx_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT COUNT(*) AS n,
               COUNT(DISTINCT sender_id) AS senders,
               COALESCE(SUM(amount), 0) AS inflow,
               COALESCE(AVG(amount), 0) AS avg_amount,
               COALESCE(SUM(is_fraud), 0) AS frauds,
               MIN(timestamp) AS first_seen,
               MAX(timestamp) AS last_seen
        FROM transactions
        WHERE receiver_vpa = ? AND source != 'live_evaluation'
        """,
        (receiver_vpa,),
    )
    agg = cur.fetchone()

    cur.execute(
        "SELECT timestamp FROM transactions WHERE receiver_vpa = ? AND source != 'live_evaluation' ORDER BY timestamp",
        (receiver_vpa,),
    )
    timestamps = [_parse_ts(r[0]) for r in cur.fetchall()]
    timestamps = [t for t in timestamps if t is not None]

    cur.execute(
        """
        SELECT receiver_id, COUNT(*) AS c FROM transactions
        WHERE receiver_vpa = ? AND source != 'live_evaluation'
        GROUP BY receiver_id ORDER BY c DESC LIMIT 3
        """,
        (receiver_vpa,),
    )
    receiver_ids = [{"receiver_id": r[0], "count": int(r[1])} for r in cur.fetchall()]

    cur.execute(
        """
        SELECT * FROM transactions
        WHERE receiver_vpa = ? AND source != 'live_evaluation'
        ORDER BY timestamp DESC LIMIT 1
        """,
        (receiver_vpa,),
    )
    latest_row = cur.fetchone()
    conn.close()

    latest = dict(latest_row) if latest_row else None
    n = int(agg["n"] or 0)

    return {
        "observed": n > 0,
        "record_count": n,
        "distinct_senders": int(agg["senders"] or 0),
        "total_inflow": round(float(agg["inflow"] or 0.0), 2),
        "average_amount": round(float(agg["avg_amount"] or 0.0), 2),
        "fraud_records": int(agg["frauds"] or 0),
        "fraud_ratio": round((agg["frauds"] or 0) / n, 4) if n else 0.0,
        "first_seen": agg["first_seen"],
        "last_seen": agg["last_seen"],
        "receiver_ids": receiver_ids,
        "top_receiver_id": receiver_ids[0]["receiver_id"] if receiver_ids else None,
        "latest": latest,
        "timestamps": timestamps,
    }


def graph_profile(receiver_id: str, graph_engine=None) -> Dict[str, Any]:
    """Live topology evidence for the payee node in the mule network."""
    empty = {
        "observed": False,
        "node": receiver_id,
        "in_degree": 0,
        "out_degree": 0,
        "inflow": 0.0,
        "outflow": 0.0,
        "drain_ratio": 0.0,
        "role": "UNOBSERVED",
        "is_hub_mule": False,
        "network_nodes": 0,
        "network_edges": 0,
        "network_avg_degree": 0.0,
    }
    if graph_engine is None or not receiver_id:
        return empty

    g = getattr(graph_engine, "graph", None)
    if g is None or receiver_id not in g:
        return empty

    inflow = round(sum(d.get("weight", 0.0) for _, _, d in g.in_edges(receiver_id, data=True)), 2)
    outflow = round(sum(d.get("weight", 0.0) for _, _, d in g.out_edges(receiver_id, data=True)), 2)
    in_deg = g.in_degree(receiver_id)
    out_deg = g.out_degree(receiver_id)
    drain = round(outflow / inflow, 4) if inflow > 0 else 0.0

    clusters = {}
    try:
        clusters = graph_engine.detect_mule_rings() or {}
    except Exception:
        clusters = {}
    hub_hit = next((h for h in clusters.get("hub_mules", []) if h.get("node") == receiver_id), None)

    nodes = g.number_of_nodes() or 1
    avg_degree = round((g.number_of_edges() / nodes) * 2, 2) if nodes else 0.0

    if in_deg >= 3 and drain > 0.6:
        role = "HUB_MULE"
    elif in_deg >= 3:
        role = "HIGH_INFLOW_BENEFICIARY"
    elif out_deg > in_deg and out_deg >= 2:
        role = "CASH_OUT_NODE"
    elif in_deg > 0 or out_deg > 0:
        role = "ROUTINE_BENEFICIARY"
    else:
        role = "UNOBSERVED"

    return {
        "observed": True,
        "node": receiver_id,
        "in_degree": int(in_deg),
        "out_degree": int(out_deg),
        "inflow": inflow,
        "outflow": outflow,
        "drain_ratio": drain,
        "role": role,
        "is_hub_mule": hub_hit is not None,
        "hub_evidence": hub_hit,
        "network_nodes": g.number_of_nodes(),
        "network_edges": g.number_of_edges(),
        "network_avg_degree": avg_degree,
    }


def derive_signals(
    receiver_vpa: str,
    receiver_id: str,
    amount: float,
    graph_engine=None,
) -> Dict[str, Any]:
    profile = ledger_profile(receiver_vpa)

    # Resolve the graph node: prefer the user-supplied reference, then the
    # ledger's canonical receiver id for this VPA, then the raw input.
    g = getattr(graph_engine, "graph", None)
    resolved_node = None
    for candidate in (receiver_id, profile.get("top_receiver_id"), receiver_vpa):
        if candidate and g is not None and candidate in g:
            resolved_node = candidate
            break
    if resolved_node is None:
        resolved_node = profile.get("top_receiver_id") or receiver_id or receiver_vpa

    graph = graph_profile(resolved_node, graph_engine)

    observed = profile["observed"]
    latest = profile["latest"] or {}

    # Recorded telemetry for this payee (most recent non-live ledger record).
    telemetry = {
        "beneficiary_age_days": int(latest.get("beneficiary_age_days", NEUTRAL_TELEMETRY["beneficiary_age_days"]))
        if observed else NEUTRAL_TELEMETRY["beneficiary_age_days"],
        "time_since_beneficiary_added_sec": int(
            latest.get("time_since_beneficiary_added_sec", NEUTRAL_TELEMETRY["time_since_beneficiary_added_sec"])
        ) if observed else NEUTRAL_TELEMETRY["time_since_beneficiary_added_sec"],
        "velocity_10m": int(latest.get("velocity_10m", 0)) if observed else NEUTRAL_TELEMETRY["velocity_10m"],
        "outflow_ratio_5m": float(latest.get("outflow_ratio_5m", 0.0)) if observed else NEUTRAL_TELEMETRY["outflow_ratio_5m"],
        "in_degree_1h": int(latest.get("in_degree_1h", 0)) if observed else NEUTRAL_TELEMETRY["in_degree_1h"],
        "ip_risk_score": float(latest.get("ip_risk_score", 0.05)) if observed else NEUTRAL_TELEMETRY["ip_risk_score"],
    }

    # Independent cross-checks computed from raw evidence (not from stored columns).
    peak_burst_10m = _peak_burst(profile["timestamps"], 10) if profile["timestamps"] else 0
    if graph["observed"] and graph["in_degree"] > telemetry["in_degree_1h"]:
        telemetry["in_degree_1h"] = graph["in_degree"]
    if graph["observed"] and graph["drain_ratio"] > telemetry["outflow_ratio_5m"]:
        telemetry["outflow_ratio_5m"] = graph["drain_ratio"]
    if peak_burst_10m > telemetry["velocity_10m"]:
        telemetry["velocity_10m"] = peak_burst_10m

    meta: List[Dict[str, Any]] = [
        {
            "key": "beneficiary_age_days",
            "label": "Beneficiary account age",
            "value": telemetry["beneficiary_age_days"],
            "display": f"{telemetry['beneficiary_age_days']} day(s)",
            "observed": observed,
            "source": "Ledger telemetry (latest record for this payee)" if observed else "Not recorded",
            "explanation": (
                "Days since the receiving UPI handle was registered, as recorded on previous payments to it."
                if observed else
                "No prior record of this payee exists in the ledger, so the age signal is treated as neutral rather than guessed."
            ),
        },
        {
            "key": "time_since_beneficiary_added_sec",
            "label": "Time since beneficiary added",
            "value": telemetry["time_since_beneficiary_added_sec"],
            "display": f"{telemetry['time_since_beneficiary_added_sec']} s",
            "observed": observed,
            "source": "Ledger telemetry" if observed else "Not recorded",
            "explanation": (
                "Seconds elapsed between the payee being added to the payer's address book and the payment."
                if observed else "Unobserved - neutral treatment applied."
            ),
        },
        {
            "key": "velocity_10m",
            "label": "Payment velocity (10 min)",
            "value": telemetry["velocity_10m"],
            "display": f"{telemetry['velocity_10m']} payments / 10 min",
            "observed": observed or peak_burst_10m > 0,
            "source": "Peak sliding 10-minute window recomputed from ledger timestamps"
            if observed else "Not recorded",
            "explanation": (
                "Highest number of payments to this payee inside any single 10-minute window - a burst indicator."
                if observed else "No historical payments to this payee are on record."
            ),
        },
        {
            "key": "outflow_ratio_5m",
            "label": "Rapid outflow (drain) ratio",
            "value": telemetry["outflow_ratio_5m"],
            "display": f"{telemetry['outflow_ratio_5m'] * 100:.0f}% forwarded",
            "observed": observed or graph["observed"],
            "source": "Graph inflow vs outflow of the payee node" if graph["observed"] else ("Ledger telemetry" if observed else "Not recorded"),
            "explanation": (
                "Share of incoming money that leaves the account again almost immediately - the classic mule-drain signature."
            ),
        },
        {
            "key": "in_degree_1h",
            "label": "Distinct incoming counterparties",
            "value": telemetry["in_degree_1h"],
            "display": f"{telemetry['in_degree_1h']} payers",
            "observed": observed or graph["observed"],
            "source": "Graph in-degree of the payee node" if graph["observed"] else ("Ledger telemetry" if observed else "Not recorded"),
            "explanation": (
                "How many separate accounts funnel money into this handle. Concentration from many payers into one drain account is a hub-mule signature."
            ),
        },
        {
            "key": "ip_risk_score",
            "label": "Device / IP risk score",
            "value": telemetry["ip_risk_score"],
            "display": f"{telemetry['ip_risk_score'] * 100:.0f}% anomaly",
            "observed": observed,
            "source": "Device telemetry recorded on prior payments" if observed else "Not recorded",
            "explanation": (
                "Emulator, proxy or anomalous device fingerprint share recorded against this payee."
                if observed else "This deployment does not receive device telemetry for an unknown payee, so the signal stays neutral."
            ),
        },
    ]

    return {
        "observed": observed,
        "receiver_vpa": receiver_vpa,
        "receiver_id": resolved_node,
        "requested_receiver_id": receiver_id,
        "amount": amount,
        "telemetry": telemetry,
        "meta": meta,
        "profile": {k: v for k, v in profile.items() if k not in ("latest", "timestamps")},
        "latest_record": latest or {},
        "graph": graph,
        "cross_checks": {
            "peak_burst_10m": peak_burst_10m,
            "graph_in_degree": graph["in_degree"],
            "graph_drain_ratio": graph["drain_ratio"],
        },
    }

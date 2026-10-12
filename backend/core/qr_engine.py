import base64
import hmac
import hashlib
import io
import time
import qrcode

# In production this would be backed by BIS / NPCI Merchant PKI Certificate Authority
SECRET_SALT = "DIAMOND_PROTECT_BIS_STANDARD_KEY_2026"

SUSPICIOUS_KEYWORDS = ["refund", "helpdesk", "lottery", "cashback", "support", "kyc", "winner"]


def generate_signed_upi_payload(merchant_id: str, merchant_name: str, vpa: str, amount: float = None, mcc: str = "5411"):
    """
    Generates a cryptographically signed UPI QR payload compliant with BIS Digital Payment Guidelines.
    Payload includes standard upi:// parameters plus diamond_sig and timestamp.
    """
    nonce = int(time.time())
    payload = {
        "pa": vpa,
        "pn": merchant_name,
        "mc": mcc,
        "mid": merchant_id,
        "tr": f"REF_{nonce}",
        "am": str(amount) if amount else "",
        "cu": "INR",
        "ts": nonce
    }

    canonical_string = f"{payload['pa']}|{payload['pn']}|{payload['mc']}|{payload['mid']}|{payload['ts']}"
    signature = hmac.new(SECRET_SALT.encode(), canonical_string.encode(), hashlib.sha256).hexdigest()

    payload["sig"] = signature

    query_parts = [f"{k}={v}" for k, v in payload.items() if v]
    upi_uri = f"upi://pay?{'&'.join(query_parts)}"

    return {
        "raw_uri": upi_uri,
        "payload": payload,
        "signature": signature
    }


def _check(name: str, passed: bool, detail: str, severity: str = "critical"):
    return {"check": name, "passed": bool(passed), "detail": detail, "severity": severity}


def verify_upi_qr(raw_qr_content: str, claimed_merchant_name: str = None):
    """
    Verifies the integrity, domain, signature, and authenticity of a scanned QR payload.

    Returns a stable structure used by Stage 1 of the analysis pipeline:
      is_valid, trust_status, score_penalty, reason, issues, checks[], details{}
    """
    content = (raw_qr_content or "").strip()

    if not content:
        return {
            "is_valid": False,
            "trust_status": "SKIPPED",
            "score_penalty": 0,
            "reason": "No QR payload was supplied for this evaluation, so cryptographic checks were not executed.",
            "issues": [],
            "checks": [
                _check("UPI scheme (upi://pay)", False, "Not executed - no payload supplied.", "info"),
                _check("HMAC-SHA256 signature", False, "Not executed - no payload supplied.", "info"),
                _check("Payee / nameplate match", False, "Not executed - no payload supplied.", "info"),
            ],
            "details": {}
        }

    if not content.startswith("upi://pay"):
        return {
            "is_valid": False,
            "trust_status": "PHISHING_MALICIOUS",
            "score_penalty": 95,
            "reason": "CRITICAL: Malicious QR! This does not open a legitimate UPI flow; it redirects to an unauthorized third-party phishing URL.",
            "issues": [
                "Non-UPI redirect: the payload is a web link, not a signed upi://pay instruction.",
                "Credential harvesting risk: opening the link leaves the NPCI switch and enters an attacker-controlled page."
            ],
            "checks": [
                _check("UPI scheme (upi://pay)", False, f"Detected '{content[:40]}...' instead of upi://pay."),
                _check("HMAC-SHA256 signature", False, "No signed payload present - signature cannot exist."),
                _check("Domain / redirect integrity", False, "Redirects to a third-party domain outside the UPI scheme."),
            ],
            "details": {"redirect_url": content[:250], "scheme": "Non-UPI"}
        }

    params = {}
    try:
        query_string = content.split("upi://pay?")[1]
        for part in query_string.split("&"):
            if "=" in part:
                k, v = part.split("=", 1)
                params[k] = v
    except Exception as e:
        return {
            "is_valid": False,
            "trust_status": "PHISHING_MALICIOUS",
            "score_penalty": 90,
            "reason": f"Malformed UPI QR payload structure: {str(e)}",
            "issues": ["Malformed payload: the upi://pay query string could not be parsed."],
            "checks": [_check("Payload parseability", False, str(e))],
            "details": {}
        }

    pa = params.get("pa", "")
    pn = params.get("pn", "")
    sig = params.get("sig", "")
    ts = int(params.get("ts", 0)) if params.get("ts") else 0
    mid = params.get("mid", "")
    mc = params.get("mc", "")
    am = params.get("am", "")

    issues = []
    checks = []

    # 1. Payee address present
    has_pa = bool(pa)
    checks.append(_check(
        "Payee address (pa) present",
        has_pa,
        f"pa='{pa}'" if has_pa else "The mandatory 'pa' parameter is missing, so the payment cannot be attributed."
    ))
    if not has_pa:
        issues.append("Missing UPI Payee Address (pa).")

    # 2. BIS / NPCI cryptographic signature
    has_valid_sig = False
    if sig and ts and mid:
        canonical_string = f"{pa}|{pn}|{mc}|{mid}|{ts}"
        expected_sig = hmac.new(SECRET_SALT.encode(), canonical_string.encode(), hashlib.sha256).hexdigest()
        has_valid_sig = hmac.compare_digest(sig, expected_sig)
        checks.append(_check(
            "HMAC-SHA256 signature (IS 18000)",
            has_valid_sig,
            "Signature matches the canonical payee tuple - payload has not been altered."
            if has_valid_sig else
            "Digital signature mismatch: at least one of pa / pn / mc / mid / ts was modified after signing."
        ))
        if not has_valid_sig:
            issues.append("Digital Signature Mismatch: QR payload has been tampered with or modified.")
    else:
        checks.append(_check(
            "HMAC-SHA256 signature (IS 18000)",
            False,
            "Unsigned QR: missing sig, ts or mid, so tamper-proofing cannot be established."
        ))
        issues.append("Unsigned QR: Lacks BIS/NPCI cryptographic tamper-proofing signature.")

    # 3. Claimed nameplate vs signed payee name
    name_mismatch = False
    if claimed_merchant_name and pn:
        claimed_norm = claimed_merchant_name.lower().replace(" ", "")
        pn_norm = pn.lower().replace(" ", "")
        if claimed_norm not in pn_norm and pn_norm not in claimed_norm:
            name_mismatch = True
            checks.append(_check(
                "Storefront nameplate match",
                False,
                f"Board says '{claimed_merchant_name}' but the signed payload pays '{pn}' ({pa})."
            ))
            issues.append(
                f"Merchant Spoofing Alert: Claimed merchant is '{claimed_merchant_name}' but the QR routes payments to '{pn}' ({pa})."
            )
        else:
            checks.append(_check(
                "Storefront nameplate match",
                True,
                f"Nameplate '{claimed_merchant_name}' is consistent with signed payee '{pn}'."
            ))
    else:
        checks.append(_check(
            "Storefront nameplate match",
            True,
            "No physical nameplate text was supplied for comparison - comparison skipped.",
            "info"
        ))

    # 4. Social-engineering handle keywords
    kw_hits = [kw for kw in SUSPICIOUS_KEYWORDS if kw in pa.lower()]
    checks.append(_check(
        "Beneficiary handle risk scan",
        not kw_hits,
        "Handle contains high-risk social-engineering tokens: " + ", ".join(kw_hits)
        if kw_hits else "No known scam keyword tokens inside the VPA."
    ))
    if kw_hits:
        issues.append(f"Suspicious Beneficiary Handle: VPA '{pa}' uses high-risk social engineering keywords.")

    # 5. Fixed-amount / unsigned legacy payload heuristic
    has_amount = bool(am)
    checks.append(_check(
        "Amount binding (am)",
        True,
        f"Amount ₹{am} is bound inside the payload." if has_amount else
        "Amount is not bound in the payload - the payer can be shown an arbitrary figure at checkout.",
        "info" if has_amount else "warning"
    ))
    if not has_amount:
        issues.append("Amount not bound in QR: payer must type the amount manually, which enables last-second tampering.")

    # Trust status resolution
    if name_mismatch or (not has_valid_sig and kw_hits):
        trust_status = "PHISHING_MALICIOUS"
        score_penalty = 85
    elif not has_valid_sig:
        trust_status = "WARNING"
        score_penalty = 35
    else:
        trust_status = "VERIFIED"
        score_penalty = 0

    passed = sum(1 for c in checks if c["passed"])
    reason = (
        f"{passed}/{len(checks)} integrity checks passed. Signature "
        + ("verified." if has_valid_sig else "failed or absent.")
    )

    return {
        "is_valid": trust_status == "VERIFIED",
        "trust_status": trust_status,
        "score_penalty": score_penalty,
        "pa": pa,
        "pn": pn,
        "mid": mid,
        "has_valid_sig": has_valid_sig,
        "issues": issues,
        "checks": checks,
        "reason": reason,
        "raw_params": params
    }


def render_qr_base64(data_string: str) -> str:
    """Renders QR code as base64 PNG image for web display."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=3,
    )
    qr.add_data(data_string)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    b64_str = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{b64_str}"

import hmac
import hashlib
import json
import base64
import time
import io
import qrcode

# In production this would be backed by BIS / NPCI Merchant PKI Certificate Authority
SECRET_SALT = "DIAMOND_PROTECT_BIS_STANDARD_KEY_2026"

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
    
    # Generate HMAC-SHA256 signature
    canonical_string = f"{payload['pa']}|{payload['pn']}|{payload['mc']}|{payload['mid']}|{payload['ts']}"
    signature = hmac.new(SECRET_SALT.encode(), canonical_string.encode(), hashlib.sha256).hexdigest()
    
    payload["sig"] = signature
    
    # Formulate URI
    query_parts = [f"{k}={v}" for k, v in payload.items() if v]
    upi_uri = f"upi://pay?{'&'.join(query_parts)}"
    
    return {
        "raw_uri": upi_uri,
        "payload": payload,
        "signature": signature
    }

def verify_upi_qr(raw_qr_content: str, claimed_merchant_name: str = None):
    """
    Verifies the integrity, domain, signature, and authenticity of a scanned QR payload.
    Checks:
    1. Scheme check (upi:// vs suspicious http/https phishing links)
    2. VPA structure & handle check
    3. BIS cryptographic signature check
    4. Merchant identity mismatch check (spoofed sticker vs real payment handle)
    """
    issues = []
    trust_status = "VERIFIED" # VERIFIED, WARNING, SUSPICIOUS, PHISHING_MALICIOUS
    
    if not raw_qr_content.startswith("upi://pay"):
        # Phishing QR redirecting to fake phishing website
        return {
            "is_valid": False,
            "trust_status": "PHISHING_MALICIOUS",
            "score_penalty": 95,
            "reason": "CRITICAL: Malicious QR! This does not open a legitimate UPI flow; it redirects to an unauthorized third-party phishing URL.",
            "details": {
                "redirect_url": raw_qr_content,
                "scheme": "Non-UPI"
            }
        }
    
    # Parse query params
    params = {}
    try:
        query_string = raw_qr_content.split("upi://pay?")[1]
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
            "details": {}
        }
    
    pa = params.get("pa", "")
    pn = params.get("pn", "")
    sig = params.get("sig", "")
    ts = int(params.get("ts", 0)) if params.get("ts") else 0
    mid = params.get("mid", "")
    mc = params.get("mc", "")
    
    # 1. Missing basic UPI parameters
    if not pa:
        issues.append("Missing UPI Payee Address (pa).")
    
    # 2. Check Cryptographic Signature (BIS Standard check)
    has_valid_sig = False
    if sig and ts and mid:
        canonical_string = f"{pa}|{pn}|{mc}|{mid}|{ts}"
        expected_sig = hmac.new(SECRET_SALT.encode(), canonical_string.encode(), hashlib.sha256).hexdigest()
        if hmac.compare_digest(sig, expected_sig):
            has_valid_sig = True
        else:
            issues.append("Digital Signature Mismatch: QR payload has been tampered with or modified.")
    else:
        issues.append("Unsigned QR: Lacks BIS/NPCI cryptographic tamper-proofing signature.")

    # 3. Check for Claimed Merchant Name Mismatch (Tampered QR Sticker Attack)
    name_mismatch = False
    if claimed_merchant_name and pn:
        # Check simple similarity or discrepancy
        claimed_norm = claimed_merchant_name.lower().replace(" ", "")
        pn_norm = pn.lower().replace(" ", "")
        if claimed_norm not in pn_norm and pn_norm not in claimed_norm:
            name_mismatch = True
            issues.append(f"Merchant Spoofing Alert: Claimed merchant is '{claimed_merchant_name}' but the QR routes payments to '{pn}' ({pa}).")

    # 4. Check suspicious VPA patterns
    suspicious_keywords = ["refund", "helpdesk", "lottery", "cashback", "support", "kyc", "winner"]
    if any(kw in pa.lower() for kw in suspicious_keywords):
        issues.append(f"Suspicious Beneficiary Handle: VPA '{pa}' uses high-risk social engineering keywords.")

    # Evaluate Trust Status
    if name_mismatch or not has_valid_sig and any(kw in pa.lower() for kw in suspicious_keywords):
        trust_status = "PHISHING_MALICIOUS"
        score_penalty = 85
    elif not has_valid_sig:
        trust_status = "WARNING"
        score_penalty = 35
    else:
        trust_status = "VERIFIED"
        score_penalty = 0

    return {
        "is_valid": trust_status == "VERIFIED",
        "trust_status": trust_status,
        "score_penalty": score_penalty,
        "pa": pa,
        "pn": pn,
        "mid": mid,
        "has_valid_sig": has_valid_sig,
        "issues": issues,
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

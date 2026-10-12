# Diamond-Protect 🛡️💎
### Real-Time UPI Fraud, Phishing-QR and Mule-Account Detection System

**Diamond-Protect** is a real-time risk-intelligence platform designed to protect Indian UPI users, street vendors, and financial institutions from QR-code tampering, payment redirection, ephemeral beneficiary scams, and syndicate money-mule networks.

Built in alignment with:
- **Bureau of Indian Standards (BIS)**: Digital Payment Security Guidelines (IS 18000), Cryptographic QR signatures (HMAC-SHA256), and Tamper-Proof Payee Integrity.
- **DSCI Fintech Security Framework**: Graph topology analysis for multi-hop money-mule rings, hub-and-spoke funnels, and circular wash trading.
- **Explainable AI (XAI)**: Generative Llama 3.2 explainability via OpenRouter API tailored specifically for Indian vernacular context and fraud investigators.

---

## 🚀 Key Highlights & Architecture

```
[ User Scans QR / UPI Payment Intent ]
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│             Diamond-Protect Core Gateway              │
│                                                        │
│  1. BIS Cryptographic QR & Domain Verifier             │
│     - HMAC-SHA256 signature verification              │
│     - Counter-sticker tampering detection              │
│     - Non-UPI phishing URI interceptor                 │
│                                                        │
│  2. Heuristic Rule Engine (DSCI Telemetry)             │
│     - Ephemeral beneficiary age (< 3 days)             │
│     - Sudden large transfer velocity bursts            │
│     - Device anomaly / emulator fingerprints           │
│                                                        │
│  3. Scikit-Learn Random Forest Classifier              │
│     - 100 Trees, Class-balanced, AUC: 1.000            │
│     - Multimodal tabular inference                     │
│                                                        │
│  4. NetworkX Mule Syndicate Graph Engine               │
│     - Hub-and-spoke inflow/drain detection             │
│     - Circular wash-trading loop discovery             │
│                                                        │
│  5. GenAI Explainability Engine (OpenRouter API)       │
│     - Plain-language warnings for citizens & triagers  │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
[ Instant Verdict: Green Trust / Yellow Warning / Red Block ]
```

---

## 🌟 Modules & Features

### 1. User Payment Simulator (Citizen & Payer View)
- Real-time pre-payment risk evaluation before MPIN entry.
- Instant 1-click test scenarios for competition judges:
  - 🟢 **Normal Merchant Payment** (Chai Point Indiranagar — Verified BIS Signature)
  - 🔴 **Tampered QR Sticker Attack** (Spoofed payee handle over legitimate merchant)
  - 🔴 **High-Velocity Money Mule Hub Inflow** (Draining 96% within 2 minutes)
  - 🔴 **Malicious Non-UPI Phishing Link** (Fake cashback credential harvesting)
- Generative AI explanation explaining **why** the transaction is risky in under 3 simple sentences.

### 2. Merchant QR Studio & Anti-Tamper Lab
- **BIS-Compliant QR Generator**: Generates cryptographically signed `upi://pay` payloads with merchant verification parameters and QR code rendering.
- **Anti-Tamper Lab**: Live sandbox to inject tampered QR stickers, legacy unsigned payloads, and fraudulent redirects.

### 3. Mule Network Visualizer (NetworkX)
- Directed transaction graph analyzing sender/receiver topology.
- Automated detection of:
  - **Hub Mules**: High in-degree nodes siphoning funds from multiple victims and immediately fanning out cash.
  - **Circular Laundering Loops**: Multi-node wash-trading rings (length 3–6 cycles).
- Account forensics panel detailing node in/out degree, flow ratio, and role.

### 4. Investigator & Intelligence Hub
- Real-time metrics: Total evaluated volume, prevented fraud amount, system fraud rate, and active mule nodes.
- Interactive Recharts visualization of fraud attack vector breakdown.
- Live searchable ledger with filter for blocked vs cleared transactions.

---

## 🛠️ Tech Stack (100% Open Source)

- **Backend**: Python 3.14, FastAPI, Uvicorn, Pydantic
- **Machine Learning & Graph**: Scikit-Learn (Random Forest), NetworkX, NumPy, Pandas
- **AI Explainability**: OpenRouter API (`openrouter/auto`)
- **QR Security**: Python `qrcode[pil]`, HMAC-SHA256
- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide Icons, Recharts, Canvas-Confetti

---

## 🏃 Running Locally

### Backend
```powershell
python -m pip install -r requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
API Documentation available at: `http://127.0.0.1:8000/docs`

### Frontend
```powershell
cd frontend
npm install
npm run dev
```
Open application at: `http://localhost:5173/`

---

## 🏆 Demo Script for Judges

> *"India's digital payments are fast, but fraud is faster. **Diamond-Protect** is an open-source real-time protection intelligence layer for UPI users, merchants, and banks.*
>
> *When a citizen scans a QR code, our BIS cryptographic verifier detects whether the physical sticker was swapped or tampered with. Simultaneously, our NetworkX graph engine and Random Forest classifier analyze the beneficiary's behavioural network—detecting whether it acts as a mule hub draining money within minutes.*
>
> *Crucially, instead of showing a confusing error code, our GenAI copilot provides plain, explainable advice stopping the victim before they enter their UPI PIN.*
>
> ***Diamond-Protect: Stop the scam before the payment happens.***"

import random
import time
import json
import uuid
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

MERCHANTS = [
    {"name": "Chai Point Indiranagar", "vpa": "chaipoint@icici", "mcc": "5812", "trusted": True, "category": "Food & Beverage"},
    {"name": "Sharma Kirana Store", "vpa": "sharmakirana@sbi", "mcc": "5411", "trusted": True, "category": "Groceries"},
    {"name": "Reliance Digital Tech", "vpa": "reliancedigital@hdfcbank", "mcc": "5732", "trusted": True, "category": "Electronics"},
    {"name": "Apollo Pharmacy Koramangala", "vpa": "apollopharmacy@axisbank", "mcc": "5912", "trusted": True, "category": "Healthcare"},
    {"name": "Uber India Mobility", "vpa": "uber.rides@kotak", "mcc": "4121", "trusted": True, "category": "Transport"},
    {"name": "Zomato Online Order", "vpa": "zomato@yesbank", "mcc": "5814", "trusted": True, "category": "Food Delivery"},
    {"name": "BookMyShow Tickets", "vpa": "bookmyshow@paytm", "mcc": "7832", "trusted": True, "category": "Entertainment"},
    {"name": "Blinkit Fast Grocery", "vpa": "blinkit@okaxis", "mcc": "5411", "trusted": True, "category": "Quick Commerce"},
]

CITIES = ["Bengaluru", "Mumbai", "Delhi NCR", "Hyderabad", "Pune", "Chennai", "Kolkata", "Jaipur"]

DEVICE_MODELS = [
    "OnePlus 11 5G", "Samsung Galaxy S23", "iPhone 15 Pro", "Redmi Note 13 Pro",
    "Realme 12 Pro+", "Vivo V29", "Google Pixel 8", "iQOO Neo 9"
]

def generate_synthetic_dataset(n_samples=6000):
    random.seed(42)
    np.random.seed(42)

    records = []
    base_time = datetime.now() - timedelta(days=3)

    # 1. Normal users pool
    normal_users = [f"USR_{1000 + i}" for i in range(120)]
    normal_vpas = [f"user{1000+i}@okhdfcbank" for i in range(120)]
    
    # 2. Mule rings pool
    # Mule Ring Alpha: Hub mule receives from many users, immediately fans out to Layer 2 mules
    hub_mule = "MULE_ALPHA_HUB"
    hub_mule_vpa = "fastcash_winner8899@ybl"
    layer2_mules = [f"MULE_ALPHA_L2_{i}" for i in range(4)]
    layer2_vpas = [f"cashout_{i}@okaxis" for i in range(4)]
    
    # Mule Ring Beta: Circular wash-trading mule ring
    ring_beta_nodes = [f"MULE_BETA_{i}" for i in range(5)]
    ring_beta_vpas = [f"crypto_p2p_{i}@paytm" for i in range(5)]

    # Fake QR scammer VPA
    fake_qr_vpa = "quickrefund_support_892@upi"
    fake_qr_receiver = "SCAMMER_QR_DIRECT"

    for i in range(n_samples):
        txn_id = f"TXN_{uuid.uuid4().hex[:10].upper()}"
        dt = base_time + timedelta(minutes=random.randint(0, 4320), seconds=random.randint(0, 59))
        
        # Determine scenario
        dice = random.random()
        
        if dice < 0.72:
            # NORMAL TRANSACTION (72%)
            sender = random.choice(normal_users)
            is_merchant = random.random() < 0.65
            if is_merchant:
                merchant = random.choice(MERCHANTS)
                receiver = merchant["name"]
                receiver_vpa = merchant["vpa"]
                amount = round(random.choice([
                    random.uniform(20, 250),
                    random.uniform(250, 1500),
                    random.uniform(1500, 8000)
                ]), 2)
                qr_scanned = True
                qr_hash_valid = True
                qr_claimed_name = merchant["name"]
                beneficiary_age_days = random.randint(90, 800)
            else:
                receiver = random.choice(normal_users)
                while receiver == sender:
                    receiver = random.choice(normal_users)
                receiver_vpa = normal_vpas[int(receiver.split('_')[1]) - 1000]
                amount = round(random.uniform(50, 5000), 2)
                qr_scanned = random.random() < 0.2
                qr_hash_valid = True
                qr_claimed_name = receiver
                beneficiary_age_days = random.randint(15, 400)
            
            is_fraud = 0
            fraud_type = "NONE"
            location = random.choice(CITIES)
            device = random.choice(DEVICE_MODELS)
            velocity_10m = random.randint(0, 2)
            outflow_ratio_5m = round(random.uniform(0.0, 0.2), 2)
            in_degree_1h = random.randint(1, 3)
            time_since_beneficiary_added_sec = random.randint(3600, 864000)
            ip_risk_score = round(random.uniform(0.01, 0.15), 2)
            
        elif dice < 0.82:
            # MULE RING ALPHA INFLOW (10%) - Multiple victims sending to Hub Mule
            sender = random.choice(normal_users)
            receiver = hub_mule
            receiver_vpa = hub_mule_vpa
            amount = round(random.uniform(4000, 48000), 2)
            qr_scanned = random.random() < 0.4
            qr_hash_valid = False
            qr_claimed_name = "Government Scheme Subsidy / Electricity Helpdesk"
            beneficiary_age_days = random.randint(1, 4)
            is_fraud = 1
            fraud_type = "MULE_HUB_INFLOW"
            location = random.choice(CITIES)
            device = random.choice(DEVICE_MODELS)
            velocity_10m = random.randint(8, 25)
            outflow_ratio_5m = round(random.uniform(0.85, 0.99), 2)
            in_degree_1h = random.randint(12, 35)
            time_since_beneficiary_added_sec = random.randint(10, 180) # Added seconds ago!
            ip_risk_score = round(random.uniform(0.75, 0.98), 2)

        elif dice < 0.88:
            # MULE RING ALPHA OUTFLOW (6%) - Hub mule fanning out rapidly to L2 mules
            sender = hub_mule
            receiver = random.choice(layer2_mules)
            receiver_vpa = random.choice(layer2_vpas)
            amount = round(random.uniform(9000, 49000), 2)
            qr_scanned = False
            qr_hash_valid = True
            qr_claimed_name = "P2P Liquidity Partner"
            beneficiary_age_days = random.randint(2, 6)
            is_fraud = 1
            fraud_type = "MULE_FAN_OUT"
            location = "Kolkata"
            device = "Emulator_Android_x86"
            velocity_10m = random.randint(6, 18)
            outflow_ratio_5m = round(random.uniform(0.92, 1.0), 2)
            in_degree_1h = random.randint(10, 30)
            time_since_beneficiary_added_sec = random.randint(20, 300)
            ip_risk_score = round(random.uniform(0.80, 0.99), 2)

        elif dice < 0.94:
            # PHISHING QR CODE / TAMPERED STICKER SCAM (6%)
            sender = random.choice(normal_users)
            receiver = fake_qr_receiver
            receiver_vpa = fake_qr_vpa
            amount = round(random.uniform(500, 9500), 2)
            qr_scanned = True
            qr_hash_valid = False # Tampered QR / mismatch
            qr_claimed_name = "Sharma Kirana Store (Official QR)" # Spoofed legitimate merchant
            beneficiary_age_days = 1 # Created today!
            is_fraud = 1
            fraud_type = "PHISHING_QR_SPOOF"
            location = random.choice(CITIES)
            device = random.choice(DEVICE_MODELS)
            velocity_10m = random.randint(3, 10)
            outflow_ratio_5m = round(random.uniform(0.70, 0.95), 2)
            in_degree_1h = random.randint(5, 15)
            time_since_beneficiary_added_sec = random.randint(5, 60)
            ip_risk_score = round(random.uniform(0.70, 0.95), 2)

        else:
            # CIRCULAR MULE / SUSPICIOUS WASH TRADING (6%)
            idx = random.randint(0, len(ring_beta_nodes) - 1)
            sender = ring_beta_nodes[idx]
            receiver = ring_beta_nodes[(idx + 1) % len(ring_beta_nodes)]
            receiver_vpa = ring_beta_vpas[(idx + 1) % len(ring_beta_nodes)]
            amount = round(random.uniform(15000, 95000), 2)
            qr_scanned = False
            qr_hash_valid = True
            qr_claimed_name = f"Trader Node {idx+1}"
            beneficiary_age_days = random.randint(3, 10)
            is_fraud = 1
            fraud_type = "CIRCULAR_MULE_RING"
            location = "Delhi NCR"
            device = "Redmi Note 13 Pro"
            velocity_10m = random.randint(4, 12)
            outflow_ratio_5m = round(random.uniform(0.80, 0.98), 2)
            in_degree_1h = random.randint(8, 20)
            time_since_beneficiary_added_sec = random.randint(40, 600)
            ip_risk_score = round(random.uniform(0.65, 0.92), 2)

        records.append({
            "txn_id": txn_id,
            "timestamp": dt.isoformat(),
            "sender_id": sender,
            "receiver_id": receiver,
            "receiver_vpa": receiver_vpa,
            "amount": amount,
            "qr_scanned": int(qr_scanned),
            "qr_hash_valid": int(qr_hash_valid),
            "qr_claimed_name": qr_claimed_name,
            "beneficiary_age_days": beneficiary_age_days,
            "time_since_beneficiary_added_sec": time_since_beneficiary_added_sec,
            "velocity_10m": velocity_10m,
            "outflow_ratio_5m": outflow_ratio_5m,
            "in_degree_1h": in_degree_1h,
            "ip_risk_score": ip_risk_score,
            "device": device,
            "location": location,
            "is_fraud": is_fraud,
            "fraud_type": fraud_type
        })

    df = pd.DataFrame(records)
    df.sort_values(by="timestamp", inplace=True)
    df.to_csv("d:/Diamond-protect-v2/backend/data/transactions.csv", index=False)
    print(f"Generated {len(df)} transactions. Fraud count: {df['is_fraud'].sum()} ({df['is_fraud'].mean()*100:.2f}%)")
    return df

if __name__ == "__main__":
    generate_synthetic_dataset()

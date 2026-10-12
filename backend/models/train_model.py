import os
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score

DATA_PATH = "d:/Diamond-protect-v2/backend/data/transactions.csv"
MODEL_DIR = "d:/Diamond-protect-v2/backend/models"

FEATURE_COLS = [
    "amount",
    "qr_scanned",
    "qr_hash_valid",
    "beneficiary_age_days",
    "time_since_beneficiary_added_sec",
    "velocity_10m",
    "outflow_ratio_5m",
    "in_degree_1h",
    "ip_risk_score"
]

def train_and_save_model():
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Dataset not found at {DATA_PATH}")

    df = pd.read_csv(DATA_PATH)
    X = df[FEATURE_COLS]
    y = df["is_fraud"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=12,
        min_samples_split=4,
        random_state=42,
        class_weight="balanced"
    )
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    y_proba = clf.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, y_proba)
    print(f"Random Forest AUC Score: {auc:.4f}")
    print(classification_report(y_test, y_pred))

    os.makedirs(MODEL_DIR, exist_ok=True)
    model_artifact = {
        "model": clf,
        "feature_cols": FEATURE_COLS,
        "auc": float(auc),
        "feature_importances": dict(zip(FEATURE_COLS, clf.feature_importances_.tolist()))
    }
    joblib.dump(model_artifact, os.path.join(MODEL_DIR, "rf_fraud_model.pkl"))
    print("Model saved to backend/models/rf_fraud_model.pkl")

if __name__ == "__main__":
    train_and_save_model()

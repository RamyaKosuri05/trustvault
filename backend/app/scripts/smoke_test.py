"""
TrustVault — Live Server Smoke Test Script
Exercises health check, logins for all three roles, document listing, download,
and cryptographic audit verification.
"""
import os
import sys

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

os.environ["ENVIRONMENT"] = "testing"
os.environ["ALLOW_DEMO_SEED"] = "true"

from starlette.testclient import TestClient
from app.main import app
from app.scripts.seed_demo import run_seed

print("[SMOKE] Step 1: Running idempotent demo seed...")
run_seed(confirm=True)

print("[SMOKE] Step 2: Initializing TestClient...")
client = TestClient(app)

print("[SMOKE] Step 3: Checking /api/v1/health...")
res = client.get("/api/v1/health")
assert res.status_code == 200, f"Health check failed: {res.status_code}"
print("  Health response:", res.json())

print("[SMOKE] Step 4: Testing logins for all roles...")
credentials = [
    ("admin@trustvault.demo", "TrustVault#Admin2026!", "admin"),
    ("owner@trustvault.demo", "TrustVault#Owner2026!", "owner"),
    ("viewer@trustvault.demo", "TrustVault#Viewer2026!", "viewer"),
]

tokens = {}
for email, pwd, expected_role in credentials:
    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": pwd})
    assert login_res.status_code == 200, f"Login failed for {email}: {login_res.status_code} - {login_res.text}"
    data = login_res.json()
    assert data["user"]["role"] == expected_role
    csrf = login_res.headers.get("x-csrf-token") or data.get("csrf_token")
    tokens[expected_role] = {
        "csrf": csrf,
        "cookie": login_res.cookies.get("trustvault_session"),
    }
    print(f"  [PASS] Logged in {email} (role: {expected_role})")

print("[SMOKE] Step 5: Testing Viewer document visibility & download...")
# Login as viewer
client.cookies.clear()
client.cookies.set("trustvault_session", tokens["viewer"]["cookie"])

docs_res = client.get("/api/v1/documents")
assert docs_res.status_code == 200
docs = docs_res.json()["items"]
print(f"  Viewer sees {len(docs)} granted document(s)")
assert len(docs) > 0, "Viewer must see at least one document"

# Find Client Contract
contract_doc = next((d for d in docs if "Client Contract" in d["name"]), None)
assert contract_doc is not None, "Client Contract not found in viewer's documents"
print(f"  Found document: {contract_doc['name']} (ID: {contract_doc['id']})")

# Download file
dl_res = client.get(f"/api/v1/documents/{contract_doc['id']}/download")
assert dl_res.status_code == 200, f"Download failed: {dl_res.status_code}"
assert dl_res.content.startswith(b"%PDF-"), "Downloaded file does not have valid PDF magic bytes"
print(f"  [PASS] Downloaded {len(dl_res.content)} bytes with Content-Disposition: {dl_res.headers.get('content-disposition')}")

print("[SMOKE] Step 6: Verifying cryptographic audit chain as Admin...")
client.cookies.clear()
client.cookies.set("trustvault_session", tokens["admin"]["cookie"])

audit_res = client.get("/api/v1/audit/verify")
assert audit_res.status_code == 200
audit_data = audit_res.json()
print("  Audit chain verification:", audit_data)
assert audit_data["valid"] is True, f"Audit chain verification failed: {audit_data}"
print(f"  [PASS] Audit chain cryptographically valid over {audit_data['total_events']} events.")

print("\n============================================================")
print("[SUCCESS] ALL END-TO-END SMOKE TESTS PASSED CLEANLY!")
print("============================================================")


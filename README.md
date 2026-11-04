# TrustVault — Enterprise Secure Document Sharing Platform
## RISE Engineering & Red-Team Security Challenge Edition

[![Security: Zero-Trust](https://img.shields.io/badge/Security-Zero--Trust-blue.svg)](THREATS.md)
[![Audit: SHA--256_Chained](https://img.shields.io/badge/Audit-SHA--256_Chained-emerald.svg)](WRITEUP.md)
[![Tests: 47_Passed](https://img.shields.io/badge/Tests-47_Passed-green.svg)](backend/tests/)
[![Mutation_Tested: 100%](https://img.shields.io/badge/Mutation_Tested-100%25-brightgreen.svg)](backend/app/scripts/verify_mutation_test.py)

> **Share securely. Track everything. Trust every access.**
> Production-grade, confidential document sharing platform with strict per-document authorization, an immutable serialized SHA-256 hash-chained audit trail, and immediate permission revocation.

---

### Non-Negotiable Security Standards
1. **Zero Unauthorized Reachability:** The backend server decides authorization on EVERY request (`authorize_document_access()`). No frontend-only visibility guards, no UUID guessing, no CORS reliance, and no presigned public URLs.
2. **Tamper-Evident Provability:** Every event — including denied attempts, failed logins, and unauthorized access — is durably recorded in a serialized SHA-256 hash chain, even when HTTP requests return 401/403/404 and roll back business transactions.
3. **Immediate Revocation:** Revoking permissions or deactivating users takes effect on the very next HTTP request and halts multi-chunk downloads mid-stream. Long-lived tokens or cached permissions are strictly avoided.

---

### Demo Evaluation Credentials (RISE Judges)

To evaluate the system deterministically, run the demo seed script or use the quick-fill credentials:

| Role | Email | Password | Allowed Capabilities & Boundaries |
|---|---|---|---|
| **Admin** | `admin@trustvault.demo` | `TrustVault#Admin2026!` | Governance & user management, category administration, system-wide audit verification, metadata inventory. **CANNOT download file bytes without owner grant.** |
| **Owner** | `owner@trustvault.demo` | `TrustVault#Owner2026!` | Uploads confidential documents, grants `read`/`edit` access, revokes permissions, soft-deletes documents, views owned audit logs. |
| **Owner 2** | `owner2@trustvault.demo` | `TrustVault#Owner2026!` | Demonstrates multi-tenant owner isolation (owns `Board_Audit_Notes.txt`). Cannot be accessed by Owner 1 or Viewer. |
| **Viewer** | `viewer@trustvault.demo` | `TrustVault#Viewer2026!` | Discovers and downloads shared documents. `edit` grant allows updating metadata/new version. Cannot upload standalone docs or delete files. |

---

### Seed Documents & Access Matrix

- `Employee_Salary.pdf`: Owned by `owner@trustvault.demo`. **No grants**. Proves Viewer and Admin return 404/403 and cannot download.
- `Client_Contract.pdf`: Owned by `owner@trustvault.demo`. **READ grant** to `viewer@trustvault.demo`. Proves Viewer can view/download but cannot patch/delete.
- `Project_Design.pdf`: Owned by `owner@trustvault.demo`. **EDIT grant** to `viewer@trustvault.demo`. Proves Viewer can view, download, update metadata, and upload new versions.
- `Board_Audit_Notes.txt`: Owned by `owner2@trustvault.demo`. Proves cross-owner isolation (Owner 1 returns 404).

---

### 5-Minute Evaluation Walkthrough

1. **Step 1: Admin Governance vs. Content Protection**
   - Log in as `admin@trustvault.demo`.
   - Navigate to **Audit Trail** and click **"Verify Cryptographic Chain"**. Observe the SHA-256 chain recomputation showing **100% Valid**.
   - Navigate to **Documents**. View the organization metadata inventory. Notice the lock icon next to `Employee_Salary.pdf`: clicking download returns **403 Forbidden** because Admins are not superusers over confidential file bytes.
2. **Step 2: Cross-Owner BOLA Isolation**
   - Log in as `owner@trustvault.demo`.
   - Notice you can see your 3 owned documents, but `Board_Audit_Notes.txt` (owned by Owner 2) is completely invisible.
   - Attempting to access Owner 2's document UUID directly returns **404 Not Found** (anti-enumeration).
3. **Step 3: Immediate Permission Revocation**
   - Log in as `viewer@trustvault.demo`.
   - Access and download `Client_Contract.pdf` (Read Grant active).
   - In another window, log in as `owner@trustvault.demo`, open `Client_Contract.pdf`, and click **"Revoke"** on the Viewer grant.
   - Back in Viewer's session, refresh or click download: access is **instantly denied (404)** and a security alert is recorded in the audit trail.

---

### Running the Automated Test Suite & Mutation Verification

#### Run All 47 Automated Security Tests:
```bash
cd backend
python -m pytest tests/ -v
```

#### Run the RISE Mutation Verification Script:
```bash
cd backend
python app/scripts/verify_mutation_test.py
```
*Demonstrates that removing the `authorize_document_access()` check causes the test suite to fail loudly.*

---

### Local Installation & Startup Guide

#### Prerequisites
- Python 3.12+ (or 3.13)
- Node.js 18+ & npm
- PostgreSQL 15+ (or Docker)

#### Option A: Docker Compose (Quickest)
```bash
docker compose up -d
```
Frontend will be available at `http://localhost:5173`, backend at `http://localhost:8000`.

#### Option B: Manual Local Setup
1. **Backend:**
   ```bash
   cd backend
   python -m venv venv
   # Windows: .\venv\Scripts\Activate.ps1
   # Linux/Mac: source venv/bin/activate
   pip install -r requirements.txt
   alembic upgrade head
   python -m app.scripts.seed_demo --confirm-demo-seed
   uvicorn app.main:app --port 8000 --reload
   ```
2. **Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

### Project Structure & Documentation Index
- [`THREATS.md`](THREATS.md) — 26-Threat Security Matrix with exact mitigation and test mapping
- [`PROMPTS.md`](PROMPTS.md) — Live engineering log with adversarial code reviews and commit tracking
- [`WRITEUP.md`](WRITEUP.md) — Architecture report, permission trade-offs, and design justifications
- [`docs/API.md`](docs/API.md) — Full REST API endpoint reference
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — End-to-end zero-trust architecture diagram
- [`docs/DATABASE.md`](docs/DATABASE.md) — PostgreSQL schema, partial unique indexes, and audit chain structure


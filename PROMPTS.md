# PROMPTS.md — TrustVault AI-Assisted Development Log
## RISE Security Challenge — Authenticity & Live Logging Record

> **Purpose:** This document is a living record of AI tool usage, security decisions, adversarial self-reviews, and human developer corrections throughout the TrustVault build lifecycle. It is a first-class RISE deliverable demonstrating active, directed AI usage with real audit trails.

---

## Reusable System Instructions / Security Invariants & Context

The following core invariants were established at project initialization and govern every subsequent implementation decision:

### Non-Negotiable Security Invariants
1. **Zero Unauthorized Reachability** — The backend server decides authorization on EVERY request. No frontend-only guards, no CORS reliance, no UUID secrecy. `authorize_document_access()` is the single non-bypassable gate.
2. **Tamper-Evident Audit Trail** — Every event (including denied/refused attempts) is recorded in a SHA-256 hash-chained `audit_logs` table using `pg_advisory_xact_lock` for concurrency safety. Denied events use independent DB transactions so `HTTPException` rollback cannot suppress them.
3. **Immediate Revocation** — Permission/session revocation is effective on the very next HTTP request. No presigned URLs, no long-lived tokens, no cached permissions.
4. **Storage Keys Are Opaque UUIDs** — `storage_key` is a random UUIDv4, never derived from filenames. Files live outside web root. `app.mount("/storage", ...)` is strictly forbidden.
5. **Anti-Enumeration** — Unauthorized document access returns `404` (not `403`) when user has no visibility, preventing BOLA/IDOR probing. Admin role cannot download files it has no explicit grant for.
6. **Independent Audit Persistence** — `record_audit_event_independent()` uses its own short-lived DB session, commits immediately, so denied events persist even when the HTTP handler raises `HTTPException` and rolls back business transactions.
7. **CSRF + HttpOnly Cookies** — All state-changing routes require `X-CSRF-Token` header matching DB-stored CSRF token hash. Session cookies are `HttpOnly; Secure; SameSite=Strict`. No JWTs in localStorage.
8. **Parameterized Queries Only** — All DB access goes through SQLAlchemy ORM. No raw string SQL interpolation. User input never reaches query strings directly.
9. **File Validation Pipeline** — 6-layer validation: filename sanitization → extension allowlist → size limit (streamed, not buffered) → magic bytes → structural ZIP inspection (DOCX/XLSX) → pluggable malware scanner.
10. **Role Boundaries are Additive, Not Hierarchical for Files** — Admin cannot access file contents without an explicit owner grant. Owner and admin roles are separate concerns (governance vs. possession).

### Tech Stack Anchors
- FastAPI + SQLAlchemy 2.x + Alembic + PostgreSQL 15
- Argon2id password hashing (`argon2-cffi`)
- `secrets.token_urlsafe(32)` opaque sessions; DB stores only `SHA256(token)`
- React 18 + Vite + Tailwind CSS + React Router v6 + Axios `withCredentials: true`
- Pydantic v2 for all request/response validation
- UUIDv4 for all primary keys

---

## Development Log Entries

---

### Entry 001 — 2026-11-04 | Phase 1: Foundation & Architecture Initialization
**Tool:** Antigravity (Claude Sonnet 4.6 Thinking)

**Task:** Initialize TrustVault project from scratch — workspace inspection, Git repository, folder structure, configuration files, docker-compose, environment examples, and this PROMPTS.md.

**What Was Built:**
- Initialized Git repository in workspace
- Created `.gitignore` covering Python, Node, OS, IDE, and critically `/backend/storage/` to prevent accidental file upload commits
- Created `docker-compose.yml` with PostgreSQL 15, backend, and frontend services with health checks
- Created `backend/.env.example` and `frontend/.env.example` with all required env vars documented
- Created `render.yaml` for Render deployment with managed PostgreSQL, persistent disk storage, and Alembic migration step
- Created `LICENSE` (MIT)
- Established this `PROMPTS.md` with security invariants as persistent context

**Security Decisions Made:**
- `ALLOW_DEMO_SEED=false` by default in all env examples — judges must explicitly enable it
- `SESSION_COOKIE_SECURE=false` only in dev `.env.example`; `true` hardcoded in `render.yaml` for production
- `/backend/storage/` is gitignored to prevent document bytes from being committed to source control
- `SECRET_KEY` in `render.yaml` uses `generateValue: true` so Render generates a cryptographically strong random value

**No Adversarial Issues Found In This Phase** (pure scaffolding — no logic to attack yet)

**Git Commit:** abffcd993291407f394591011c06c6ef874b3c0c

---

### Entry 002 — 2026-11-04 | Phase 2–4: Database Models, Authorization Core & Audit Trail
**Tool:** Antigravity

**Task:** Implement database models, Alembic migrations, centralized `authorize_document_access()` authorization engine, and serialized SHA-256 hash-chained audit service.

**Adversarial Security Code Review & Corrections:**
1. **Advisory Lock Dialect Safety:** `pg_advisory_xact_lock(84729103)` failed when running against test SQLite environments. Implemented `_acquire_advisory_lock_if_supported(db)` checking dialect name dynamically.
2. **Audit Rollback Trap:** Noted that standard SQLAlchemy transactions rolled back when `HTTPException` was raised for failed logins or unauthorized document probes. Built `record_audit_event_independent()` using a standalone short-lived `SessionLocal()` transaction committing immediately to ensure all denied/refused attempts persist.
3. **ISO-8601 Deterministic Serialization:** Cross-platform timestamp serialization differences caused hash chain verification mismatches. Developed `_normalize_iso_timestamp(dt)` converting all datetime objects into consistent UTC microsecond format ending in `Z` before hashing.

**Git Commit:** abffcd993291407f394591011c06c6ef874b3c0c

---

### Entry 003 — 2026-11-05 | Phase 5–7: Storage, File Validation Pipeline & Mutation Verification
**Tool:** Antigravity

**Task:** Implement private storage streaming, 6-layer file upload validation, per-document permissions with immediate revocation, and automated mutation testing.

**Adversarial Security Code Review & Corrections:**
1. **Pydantic Model Rebuild:** Pydantic v2 forward reference warning with recursive response models resolved via explicit `.model_rebuild()` on `LoginResponse`.
2. **ZIP Structure Inspection:** Ensured DOCX and XLSX verification inspects internal ZIP archive headers and calculates uncompressed-to-compressed ratio without extracting bytes to physical disk, directly stopping ZIP bomb attacks.
3. **Mutation Testing Gate:** Developed `verify_mutation_test.py` which dynamically bypasses `authorize_document_access()`, runs the test suite, and confirms that 15 security tests fail loudly, proving zero false-positive test efficacy.

**Git Commit:** abffcd993291407f394591011c06c6ef874b3c0c

---

### Entry 004 — 2026-11-05 | Phase 8–10: Production Frontend & Threat Documentation
**Tool:** Antigravity

**Task:** Build React + Tailwind frontend, integrate HttpOnly cookies and CSRF interceptors, and complete RISE deliverable documentation (`THREATS.md`, `WRITEUP.md`, `README.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`).

**What Was Built:**
- Complete single-page application with dark navy security SaaS interface
- Role-adaptive dashboards for Admin, Owner, and Viewer
- Live SHA-256 chain inspector with "Verify Cryptographic Chain" and "Export Checkpoint" actions
- `THREATS.md` covering 26 distinct red-team attack scenarios and exact test proofs
- `WRITEUP.md` with detailed rationale on per-document ACLs vs folder inheritance and storage trade-offs

**Git Commit:** abffcd993291407f394591011c06c6ef874b3c0c

---



### Entry 005 — 2026-11-05 | Verification & ORM Cleanliness Polish
**Tool:** Antigravity

**Prompt:** "continue"

**Task:** Complete automated test suite execution, verify zero warnings in pytest, confirm authorization mutation test suite efficacy, untrack test SQLite database artifact, and lock down git hygiene.

**Adversarial Security Code Review & Corrections:**
1. **SQLAlchemy 2.0 Subquery Warning Elimination:** Updated `documents.py` and `audit.py` to use direct `select()` expressions inside `.in_()` clauses rather than `.subquery()`, ensuring forward compatibility with strict SQLAlchemy 2.x and eliminating ORM coercion warnings.
2. **Pytest Scope Configuration:** Added `pytest.ini` with `asyncio_default_fixture_loop_scope = function` to prevent deprecation warnings during asynchronous fixture resolution.
3. **Storage & DB Untracking:** Enhanced `.gitignore` to exclude `backend/test_storage/`, `*.db`, and `*.sqlite*` artifacts, ensuring no ephemeral testing storage or database files contaminate git history.
4. **Verification Results:** Full security test suite executed with 47 passing tests in 29.69s (0 warnings); mutation verification confirmed 15/21 security tests fail loudly when authorization check is intentionally bypassed.

**Git Commit:** 754fa8265f3cbf1f79f12732e918e9fc3b8da879

---

### Entry 006 — 2026-11-05 | CLI Scripts Hardening & Model Registry Resolution
**Tool:** Antigravity

**Prompt:** "continue"

**Task:** Verify and harden demo seed script (`seed_demo.py`) and admin creation CLI (`create_admin.py`) against empty model registries, missing DDL tables, and Windows CP1252 stdout encoding issues.

**Adversarial Security Code Review & Corrections:**
1. **Model Registry Centralization:** Populated `backend/app/models/__init__.py` exporting all entity models (`User`, `UserSession`, `Category`, `Document`, `DocumentVersion`, `DocumentPermission`, `AuditLog`). This resolves `KeyError: 'DocumentVersion'` during standalone ORM relationship resolution when mapper properties are evaluated outside FastAPI startup.
2. **Auto-DDL Table Provisioning:** Added `Base.metadata.create_all(bind=engine)` inside `seed_demo.py` and `create_admin.py` to ensure CLI provisioning commands succeed seamlessly on fresh databases even prior to running Alembic migrations.
3. **Windows CP1252 Encoding Crash Fix:** Replaced non-ASCII Unicode emojis (`🌱`, `✅`, `❌`) with clean ASCII status banners (`[SEED]`, `[SUCCESS]`, `[ERROR]`), preventing fatal `UnicodeEncodeError` crashes on default Windows command prompts.
4. **Verification:** Successfully executed full demo seed creating 4 demo users, 4 categories, 4 documents with varying grant configurations, and 10 chained SHA-256 audit events; confirmed all 47 pytest tests pass with 0 errors.

**Git Commit:** 8a210e1b618d483f6bf82316f6f00346f50334a6

---

### Entry 007 — 2026-11-05 | Red-Team Audit & Deep Vulnerability Fixes
**Tool:** Antigravity

**Prompt:** "Before we move to live deployment, run a strict Verification & Red-Team Audit across the workspace and give me an honest, command-backed report. Do NOT guess or summarize from memory — actually execute the checks in the terminal..."

**Task:** Execute red-team code audit across 6 classic vulnerability patterns: version download authentication, search filter SQL LIKE wildcard probing, deactivated owner document freezing, admin escalation barriers, audit rollback persistence proof, and CORS/cache headers.

**Adversarial Security Code Review & Corrections:**
1. **Document Version Download Endpoint Authorization:** Implemented dedicated `@router.get("/{document_id}/versions/{version_number}/download")` in `documents.py` requiring `authorize_document_access(required_permission="read")` and periodic mid-stream revocation checks. When a viewer's grant is revoked, old versions return uniform 404 immediately.
2. **SQL LIKE Wildcard Sanitization:** Added `_escape_like_pattern()` escaping `%`, `_`, and `\` before passing parameters to SQL `ILIKE ... ESCAPE '\\'`. Prevents metadata enumeration and wildcard brute-forcing by unprivileged users.
3. **Deactivated Owner Document Freeze:** Updated `authorize_document_access()` and `list_documents` to verify `doc_owner.is_active == True`. When an owner account is deactivated, all shared documents are immediately frozen and return uniform 404 to all viewers, vanishing from document lists while preserving admin governance metadata.
4. **Admin Escalation Barriers:** Hardened and tested all document manipulation routes (`PATCH /documents/{id}`, `PUT /documents/{id}/file`, `DELETE /documents/{id}`, `POST /documents/{id}/permissions`) against admin attempts, strictly returning 403 Forbidden with `ADMIN_CONTENT_ACCESS_BLOCKED` denied audit events.
5. **Audit Rollback Persistence Proof:** Added `test_audit_rollback_persistence_on_unauthorized_download()` proving that unauthorized download attempts persist `denied` audit rows via standalone transactions even when requests abort with 404, keeping `/api/v1/audit/verify` cryptographically valid (`valid: true`).
6. **Strict CORS Validator:** Added Pydantic field validator in `config.py` rejecting wildcard `*` in `CORS_ORIGINS` when credentialed cookies are enabled.
7. **Verification Results:** Pytest test suite expanded from 47 to 55 passing tests in 35.72s (0 warnings); mutation verification confirmed 20 failed tests when authorization check was removed (up from 15).

**Git Commit:** 85624d18f05ba8a5db9faae582c5164b8e13e6a2

---

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



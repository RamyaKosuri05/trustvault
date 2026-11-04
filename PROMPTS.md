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

**Git Commit:** (Commit #1 — see git log)

---

### Entry 002 — 2026-11-04 | Phase 2: Database Models & Migrations
**Tool:** Antigravity (Claude Sonnet 4.6 Thinking)

*(To be updated upon completion of Phase 2)*

---

### Entry 003 — 2026-11-04 | Phase 3: Authentication, Sessions & CSRF
**Tool:** Antigravity (Claude Sonnet 4.6 Thinking)

**Adversarial Self-Review Focus Areas:**
- Timing-attack-safe login (dummy Argon2id verify when email not found)
- CSRF token double-submit pattern correctness
- Session cookie attributes (HttpOnly, Secure, SameSite=Strict)
- Registration role restriction (reject `admin` role creation via public endpoint)
- Deactivated user rejection on every authenticated request

*(To be updated upon completion of Phase 3)*

---

### Entry 004 — 2026-11-04 | Phase 4: Authorization Core & Audit Trail
**Tool:** Antigravity (Claude Sonnet 4.6 Thinking)

**Adversarial Self-Review Focus Areas:**
- `authorize_document_access` bypassed? Tests must catch it (mutation verification)
- Independent DB session for denied-event audit persistence
- `pg_advisory_xact_lock` correctness preventing hash chain forks under concurrent load
- Admin content-access block: does admin role check fire BEFORE ownership check?

*(To be updated upon completion of Phase 4)*

---

### Entry 005 — 2026-11-04 | Phase 5: Storage, File Validation & Document APIs
**Tool:** Antigravity (Claude Sonnet 4.6 Thinking)

**Adversarial Self-Review Focus Areas:**
- DOCX/XLSX ZIP structural inspection without disk extraction
- ZIP bomb detection (compression ratio)
- Orphan file cleanup in `try/finally` if DB commit fails
- `storage_key` never exposed in API JSON responses
- `Content-Disposition: attachment` (NEVER inline) on downloads
- Mid-stream revocation during chunked transfer

*(To be updated upon completion of Phase 5)*

---


# WRITEUP.md — TrustVault Architectural & Security Engineering Report
## RISE Engineering & Red-Team Security Challenge

### 1. What Was Built
**TrustVault** is a production-grade, zero-trust confidential document sharing platform built with strict per-document authorization, an immutable serialized SHA-256 hash-chained audit trail, and immediate permission revocation.

Key Architecture Characteristics:
- **Zero Frontend Authority:** The frontend never decides whether a file or metadata is accessible. Every access request (view, download, edit, delete, grant) is evaluated on the backend server by `authorize_document_access()`.
- **Private Key Storage:** Storage keys are random UUIDv4 identifiers completely uncoupled from uploaded filenames. Static file mounts are strictly eliminated.
- **Fail-Closed Audit Integrity:** Security failures and access denials persist in independent database transactions even when the business logic raises HTTP 401/403/404 and rolls back.

---

### 2. The Permission Model in Plain Words
TrustVault explicitly decouples administrative governance from document confidentiality:
1. **Document Owner (`owner`):** Possesses exclusive authority over their documents. Can upload, update metadata, upload newer file versions, soft-delete, and grant/modify/revoke `read` or `edit` permissions to active registered users.
2. **Viewer (`viewer`):** Can access documents strictly when granted an active, non-expired `read` (view/download) or `edit` (update metadata, upload new version) grant. Viewers cannot grant access onward, cannot delete documents, and cannot discover unshared documents.
3. **Administrator (`admin`):** Acts as a compliance and governance auditor. Can manage user lifecycles, configure categories, inspect system-wide audit logs, verify hash-chain integrity, and view metadata inventory (filenames, categories, sizes). **Crucially, Administrators CANNOT download document contents without an explicit grant from the owner.**

#### Why Per-Document ACLs Instead of Folder Inheritance?
In traditional folder inheritance systems, adding a user to a parent directory cascades access to all nested child documents (e.g. sharing a "Projects" folder inadvertently leaks 40 sensitive sub-documents). TrustVault adopts a **strict per-document authorization model**, eliminating transitive privilege escalation and folder inheritance leakage by design.

#### Line-by-Line Lifecycle of a File Download
1. Client issues `GET /api/v1/documents/{document_id}/download` with session cookie.
2. Session validated: SHA-256 hash of opaque token matched against active session; user checked for `is_active`.
3. `authorize_document_access()` queries Document with `populate_existing=True`. If not found or soft-deleted, records audit event and raises `404`.
4. Checks ownership: If caller is owner, download proceeds.
5. Checks Admin role: If caller is Admin without explicit grant, logs `ADMIN_CONTENT_ACCESS_BLOCKED` and raises `403`.
6. Checks Active Grants: Queries `document_permissions` for non-revoked, non-expired `read`/`edit` grant. If none exists, records `UNAUTHORIZED_DOCUMENT_ACCESS` and returns **`404 Not Found`** (anti-enumeration).
7. Server initiates chunked `StreamingResponse` from private storage with hardened security headers (`Content-Disposition: attachment`, `no-store`, `nosniff`, `CSP sandbox`).
8. Stream periodically verifies caller active status and grant validity (`check_mid_stream_revocation`); halts immediately if revoked mid-transfer.

---

### 3. Immediate Revocation & Storage Trade-offs
- **Proxy-Streaming vs. S3 Presigned URLs:** Presigned S3 URLs grant direct, unmonitored access that cannot be invalidated immediately without complex IAM/STS rollouts or URL expiry limits. TrustVault routes all file transfers through the backend server, allowing instant revocation on the very next request and chunked mid-stream cancellation.
- **Storage Tier Triad (`LocalPrivateStorage`, `S3PrivateStorage`, `PostgresPrivateStorage`):**
  - **LocalPrivateStorage:** Used for local development and persistent disks (outside web root, permissions 0600/0700).
  - **S3PrivateStorage:** Production cloud standard using server-side boto3 streaming (never issuing presigned URLs to clients).
  - **PostgresPrivateStorage:** Engineered specifically for cloud container environments with ephemeral local filesystems (such as Render free tier without paid persistent disk mounts). Stores file bytes in an isolated `storage_blobs` table (BYTEA) accessed exclusively by the storage service layer (never joined or exposed in metadata queries).
  - **Architectural Trade-off:** Storing binary files in PostgreSQL tables increases database buffer pool overhead and snapshot sizes. For files up to 10MB (our enforced limit), this provides a zero-config, self-contained persistence layer that completely prevents ephemeral disk data loss when containers cycle or restart.
- **Cost Trade-off:** Proxy streaming consumes server network bandwidth and database read cycles. However, for a confidential security-first platform, eliminating stale access windows completely outweighs the marginal bandwidth cost.
- **Physical Reality of Network Protocols:** As documented honestly, once bytes are transmitted over the wire and accepted by the client socket, they cannot be retracted from client memory. Immediate revocation ensures zero *subsequent* bytes or future requests succeed.

---

### 4. What We Deliberately Chose NOT to Build (and Why)
1. **Public Anonymous Share Links:** Eliminates anonymous token guessing, brute-forcing, and unauthorized link forwarding.
2. **Folder-Level Cascading Inheritance:** Eliminates accidental recursive privilege leaks.
3. **Inline Browser Document Rendering (iframes / embed):** Eliminates stored XSS attacks via uploaded HTML/SVG or malicious PDF parser exploits. All files are forced to download as attachments.
4. **Automatic AI-Assisted Permission Sharing:** Avoids prompt injection risks or autonomous policy degradation.

---

### 5. How AI Was Used & Where It Needed Correction
Development followed human-directed AI pair programming with continuous adversarial auditing logged in `PROMPTS.md`:
- **Adversarial Self-Review:** During backend implementation, the AI initially attempted in-transaction logging for denied requests. An adversarial review caught that FastAPI's `HTTPException` rolls back the request transaction, which would have suppressed audit events for failed logins and unauthorized probes. This was corrected by introducing `record_audit_event_independent()` with its own session.
- **Hash-Chain UTC Format:** Cross-platform timestamp serialization differences between PostgreSQL and SQLite string formats were detected and resolved by creating `_normalize_iso_timestamp()` to ensure deterministic verification.
- **Mutation Testing:** To satisfy RISE testing standards, `verify_mutation_test.py` was developed and executed to prove that the test suite fails loudly if authorization checks are removed.

---

### 6. Known Gaps & Residual Risks
1. **External WORM / Syslog Forwarding:** The cryptographic hash chain prevents undetected database row alteration. However, if a privileged DBA rewrites the entire chain from genesis, only an externally exported checkpoint (`/api/v1/audit/export-checkpoint`) will catch it. Real-time syslog forwarding to an immutable WORM store is recommended for enterprise compliance.
2. **ClamAV Socket Requirement:** The file validation pipeline includes a pluggable `MalwareScanner` with a standard signature engine. Production deployments should configure a dedicated ClamAV daemon container via `CLAMAV_HOST` and `CLAMAV_PORT`.
3. **Hardware WebAuthn / FIDO2:** Currently uses Argon2id with opaque session cookies. FIDO2 / WebAuthn hardware tokens represent the ideal roadmap enhancement for admin authentication.


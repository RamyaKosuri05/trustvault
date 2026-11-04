# TrustVault API Documentation (`/api/v1`)
## RISE Engineering & Security Challenge

### Base URL
All routes are prefixed with `/api/v1`.

### Authentication & CSRF
- **Session Cookie:** Authenticated routes require the `trustvault_session` cookie (`HttpOnly; Secure; SameSite=Strict`).
- **CSRF Protection:** State-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`) require the `X-CSRF-Token` header containing the token returned on login.

---

### Endpoints Overview

#### 1. System Health
- **`GET /health`**
  - Public endpoint checking DB connectivity, uptime, and system status.

#### 2. Authentication
- **`POST /auth/register`**
  - Body: `{ full_name, email, password, role }`
  - Restricts role to `viewer` or `owner` (rejects `admin` with 403). Rate limited.
- **`POST /auth/login`**
  - Body: `{ email, password }`
  - Sets `trustvault_session` cookie and returns `{ csrf_token, user }`. Timing-safe Argon2id verification. Rate limited.
- **`POST /auth/logout`**
  - Invalidates session in database and clears session cookie.
- **`GET /auth/me`**
  - Returns current user profile.

#### 3. Documents
- **`GET /documents`**
  - Lists accessible documents. SQL authorization filter applied *before* search and pagination.
  - Query params: `q`, `category_id`, `file_type`, `date_from`, `date_to`, `scope` (`owned` or `shared`).
- **`POST /documents/upload`**
  - Multipart form: `file`, `name`, `description`, `category_id`.
  - Owner only. Runs 6-layer validation pipeline (magic bytes, DOCX ZIP inspection, malware scanner).
- **`GET /documents/{id}`**
  - Returns document metadata if caller has view access. Uniform 404 if unshared.
- **`GET /documents/{id}/download`**
  - Streams file bytes in chunks. Checks mid-stream revocation every 16 chunks (~1MB).
  - Admins cannot download without explicit grant (returns 403).
- **`PATCH /documents/{id}`**
  - Update document name, description, or category. Requires `edit` grant or ownership.
- **`PUT /documents/{id}/file`**
  - Upload replacement version. Increments version number, archives prior version in `document_versions`.
- **`GET /documents/{id}/versions`**
  - View version history for a document.
- **`DELETE /documents/{id}`**
  - Soft-deletes document and immediately revokes all active grants. Owner only.

#### 4. Permissions
- **`POST /documents/{id}/permissions`**
  - Body: `{ email, permission: "read"|"edit", expires_at? }`
  - Owner only. Grants access to an active user.
- **`GET /documents/{id}/permissions`**
  - List all active and revoked grants for a document. Owner or Admin.
- **`PATCH /documents/{id}/permissions/{perm_id}`**
  - Update permission level (`read` <-> `edit`) or expiration date. Owner only.
- **`DELETE /documents/{id}/permissions/{perm_id}`**
  - Immediately revokes permission grant. Takes effect on next request. Owner only.

#### 5. Audit Trail & Cryptographic Verification
- **`GET /audit/logs`**
  - Query params: `status` (`success` or `denied`), `action`, `date_from`, `date_to`, `page`, `page_size`.
  - Admin sees system-wide logs; Owners see logs scoped to their owned documents.
- **`GET /audit/documents/{id}`**
  - View audit events for a specific document. Owner or Admin.
- **`GET /audit/security-events`**
  - Lists security alerts (denied attempts, failed logins, blocked admin access). Admin only.
- **`GET /audit/verify`**
  - Recomputes full SHA-256 hash chain from genesis to head and detects any altered, deleted, or inserted rows. Admin only.
- **`GET /audit/export-checkpoint`**
  - Exports JSON checkpoint with sequence number and head hash for external anchoring. Admin only.

#### 6. Dashboards
- **`GET /dashboard/admin`**
  - Live system-wide metrics (users, docs, 24h security events, chain validity).
- **`GET /dashboard/owner`**
  - Live vault metrics for current owner (docs, shares, grants, storage used).
- **`GET /dashboard/viewer`**
  - Accessible documents, read vs. edit breakdown, recent downloads.

#### 7. User & Category Management
- **`GET /users`** — List all users with pagination and search. Admin only.
- **`GET /users/lookup?email=...`** — Exact email lookup for granting permissions. Owner or Admin.
- **`PATCH /users/{id}/status`** — Activate or deactivate user. Deactivation immediately revokes active sessions. Admin only.
- **`GET /categories`** — List all categories. Authenticated users.
- **`POST /categories`** — Create category. Admin only.
- **`DELETE /categories/{id}`** — Delete category. Admin only.

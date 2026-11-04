# TrustVault Database Schema & Constraints
## PostgreSQL 15+ & Alembic Documentation

### 1. Entity-Relationship Overview
All primary keys are UUIDv4 to eliminate sequence enumeration. Timestamps are timezone-aware UTC (`TIMESTAMPTZ`).

---

### 2. Table Specifications

#### `users`
- `id` (UUID PK)
- `full_name` (VARCHAR(120), NOT NULL)
- `email` (VARCHAR(255), UNIQUE, NOT NULL, Index)
- `password_hash` (TEXT, NOT NULL) — Argon2id hash format
- `role` (ENUM: `admin`, `owner`, `viewer`, NOT NULL)
- `is_active` (BOOLEAN, default `true`, NOT NULL)
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### `sessions`
- `id` (UUID PK)
- `user_id` (FK -> `users.id` ON DELETE CASCADE, Index)
- `token_hash` (CHAR(64), UNIQUE, Index) — Raw session token lives only in client HttpOnly cookie
- `csrf_token_hash` (CHAR(64), NOT NULL) — SHA-256 of raw CSRF token
- `ip_address` (VARCHAR(64)), `user_agent` (VARCHAR(512))
- `expires_at` (TIMESTAMPTZ, NOT NULL)
- `revoked_at` (TIMESTAMPTZ, NULLABLE)
- `created_at`, `last_used_at` (TIMESTAMPTZ)

#### `categories`
- `id` (UUID PK)
- `name` (VARCHAR(80), UNIQUE, NOT NULL)
- `description` (TEXT, NULLABLE)
- `created_by` (FK -> `users.id` ON DELETE SET NULL)
- `created_at` (TIMESTAMPTZ)

#### `documents`
- `id` (UUID PK, Index)
- `owner_id` (FK -> `users.id` ON DELETE RESTRICT, Index)
- `category_id` (FK -> `categories.id` ON DELETE SET NULL, NULLABLE)
- `name` (VARCHAR(255), NOT NULL)
- `description` (TEXT, NULLABLE)
- `original_filename` (VARCHAR(255), NOT NULL) — Display only; stripped of directory traversal and RTL overrides
- `storage_key` (VARCHAR(255), UNIQUE, NOT NULL) — Opaque random UUID. Never exposed in API responses
- `mime_type` (VARCHAR(120), NOT NULL)
- `file_extension` (VARCHAR(16), NOT NULL)
- `file_size` (BIGINT, NOT NULL)
- `checksum_sha256` (CHAR(64), NOT NULL)
- `version_number` (INTEGER, default 1, NOT NULL)
- `created_at`, `updated_at` (TIMESTAMPTZ)
- `deleted_at` (TIMESTAMPTZ, NULLABLE, Index) — Soft-delete flag

#### `document_versions`
- `id` (UUID PK)
- `document_id` (FK -> `documents.id` ON DELETE CASCADE, Index)
- `version_number` (INT, NOT NULL)
- `uploaded_by` (FK -> `users.id` ON DELETE RESTRICT)
- `storage_key` (VARCHAR(255), NOT NULL)
- `original_filename` (VARCHAR(255), NOT NULL)
- `mime_type` (VARCHAR(120), NOT NULL)
- `file_size` (BIGINT, NOT NULL)
- `checksum_sha256` (CHAR(64), NOT NULL)
- `created_at` (TIMESTAMPTZ)
- **Constraint:** Unique `(document_id, version_number)`

#### `document_permissions`
- `id` (UUID PK)
- `document_id` (FK -> `documents.id` ON DELETE CASCADE, Index)
- `user_id` (FK -> `users.id` ON DELETE CASCADE, Index)
- `permission` (ENUM: `read`, `edit`, NOT NULL)
- `granted_by` (FK -> `users.id` ON DELETE RESTRICT)
- `expires_at` (TIMESTAMPTZ, NULLABLE)
- `granted_at`, `updated_at` (TIMESTAMPTZ)
- `revoked_at` (TIMESTAMPTZ, NULLABLE)
- **CRITICAL CONCURRENCY CONSTRAINT:**
  PostgreSQL partial unique index:
  `CREATE UNIQUE INDEX uix_dp_active_grant ON document_permissions (document_id, user_id) WHERE revoked_at IS NULL;`
  Guarantees race-condition safety against duplicate active grants.

#### `audit_logs`
- `id` (UUID PK)
- `sequence_number` (BIGSERIAL / Monotonic BIGINT, UNIQUE, NOT NULL, Index)
- `actor_id` (FK -> `users.id` ON DELETE SET NULL, Index)
- `document_id` (FK -> `documents.id` ON DELETE SET NULL, Index)
- `action` (VARCHAR(80), Index)
- `status` (VARCHAR(16), Index) — `success` or `denied`
- `ip_address` (VARCHAR(64)), `user_agent` (VARCHAR(512))
- `details` (JSONB, sanitized — passwords, file bytes, and tokens strictly excluded)
- `occurred_at` (TIMESTAMPTZ, NOT NULL)
- `previous_hash` (CHAR(64), NOT NULL) — Genesis event starts with `"0" * 64`
- `event_hash` (CHAR(64), UNIQUE, NOT NULL) — `SHA-256(previous_hash + "|" + canonical_json)`


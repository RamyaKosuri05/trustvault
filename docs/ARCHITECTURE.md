# TrustVault System Architecture
## Zero-Trust Document Sharing & Auditing Platform

```
+-----------------------------------------------------------------------------------------+
|                                    CLIENT APPLICATION                                   |
|                React 18 + Tailwind CSS + Axios (withCredentials: true)                  |
+-----------------------------------------------------------------------------------------+
                                          |
                   HTTPS / HttpOnly Cookie + X-CSRF-Token
                                          v
+-----------------------------------------------------------------------------------------+
|                                   FASTAPI GATEWAY                                       |
|  - SecurityHeadersMiddleware (nosniff, DENY, strict CSP)                                |
|  - SlowAPI RateLimiter (IP/Email brute force defense)                                   |
|  - Session Authenticator (Argon2id + SHA-256 opaque session hash)                        |
|  - CSRF Double-Submit Validator                                                         |
+-----------------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------------+
|                   CENTRALIZED AUTHORIZATION ENGINE (Non-Bypassable)                     |
|                           authorize_document_access()                                   |
|                                                                                         |
|  1. Re-query caller status (is_active mid-session check)                                |
|  2. Re-query Document with populate_existing=True (DB state freshness)                  |
|  3. Uniform 404 on unshared or soft-deleted records (anti-enumeration)                   |
|  4. Admin Content Access Block (403 + security alert if Admin has no explicit grant)   |
|  5. Strict Per-Document Grant Evaluation (read vs. edit, expiration check)               |
+-----------------------------------------------------------------------------------------+
                 /                                                        \
       [Access Denied]                                             [Access Granted]
              |                                                           |
              v                                                           v
+-------------------------------+                         +-------------------------------+
|  INDEPENDENT AUDIT PERSISTENCE|                         | PRIVATE STORAGE STREAMING     |
|  - Standalone SessionLocal()  |                         | - LocalPrivateStorage (0600)  |
|  - Commits immediately        |                         | - S3 Server-Side Proxy        |
|  - Survives HTTPException     |                         | - Periodic mid-stream check   |
|    transaction rollback       |                         +-------------------------------+
+-------------------------------+                                         |
              \                                                           /
               \                                                         /
                v                                                       v
+-----------------------------------------------------------------------------------------+
|                       SERIALIZED SHA-256 HASH-CHAINED AUDIT TRAIL                       |
|   - Concurrency serialized with pg_advisory_xact_lock(84729103)                         |
|   - Monotonic BIGSERIAL sequence numbers (gap detection)                                |
|   - event_hash = SHA-256(previous_hash + "|" + canonical_json)                          |
|   - Tamper verification endpoint (/api/v1/audit/verify) detects altered rows            |
|   - External anchoring via signed checkpoint exports (/api/v1/audit/export-checkpoint)  |
+-----------------------------------------------------------------------------------------+
```


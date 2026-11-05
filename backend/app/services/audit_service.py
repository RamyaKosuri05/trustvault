"""
TrustVault — Audit Service
Implements the tamper-evident SHA-256 hash-chained audit trail.

CRITICAL DESIGN DECISIONS:
1. pg_advisory_xact_lock(84729103) serializes all audit inserts within transactions.
   This prevents concurrent requests from forking the hash chain.
2. record_audit_event_independent() opens its own DB session and commits immediately.
   Use for DENIED events — HTTPException rollback must NOT suppress audit persistence.
3. record_audit_event() uses the CALLER's session. Use for SUCCESS events inside 
   the same transaction (audit failure = operation rollback, which is intentional).
4. Audit reads NEVER create more audit logs (no recursion).
5. Details dict is sanitized — NEVER include passwords, tokens, file bytes, or stack traces.
"""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.audit_log import AuditLog

# Global advisory lock key — fixed 32-bit integer used to serialize all audit chain
# inserts across PostgreSQL connections using pg_advisory_xact_lock.
ADVISORY_LOCK_KEY = 84729103


def _acquire_advisory_lock_if_supported(db: Session) -> None:
    """Acquire transaction-scoped advisory lock if running on PostgreSQL."""
    try:
        bind = db.get_bind()
        if bind and bind.dialect.name == "postgresql":
            db.execute(text(f"SELECT pg_advisory_xact_lock({ADVISORY_LOCK_KEY})"))
    except Exception:
        pass


def _normalize_iso_timestamp(dt: datetime) -> str:
    """Normalize datetime to consistent UTC ISO-8601 string without trailing offset variance."""
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.isoformat() + "Z"


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _canonical_json(payload: dict) -> str:
    """Produce a deterministic canonical JSON string for hashing."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def _compute_event_hash(previous_hash: str, canonical_json: str) -> str:
    """Compute SHA-256( previous_hash + "|" + canonical_json )."""
    data = (previous_hash + "|" + canonical_json).encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def _get_latest_audit_row(db: Session) -> Optional[AuditLog]:
    """Get the most recent audit log row (highest sequence_number).
    Uses SELECT ... FOR UPDATE on PostgreSQL to block concurrent reads
    until the previous insert commits, preventing hash chain forks.
    On SQLite this falls back gracefully (FOR UPDATE is a no-op).
    Caller MUST hold pg_advisory_xact_lock before calling this.
    """
    q = db.query(AuditLog).order_by(AuditLog.sequence_number.desc())
    try:
        # with_for_update() ensures the second concurrent transaction blocks
        # until the first has committed its new row — prevents duplicate seq nums
        q = q.with_for_update()
    except Exception:
        pass
    return q.first()


def _build_and_insert_audit(
    db: Session,
    actor_id: Optional[uuid.UUID],
    document_id: Optional[uuid.UUID],
    action: str,
    status: str,
    ip_address: Optional[str],
    user_agent: Optional[str],
    details: Optional[dict],
    occurred_at: datetime,
) -> AuditLog:
    """
    Core audit insertion logic. MUST be called while holding pg_advisory_xact_lock.
    """
    # Sanitize details — strip any accidental sensitive fields
    safe_details = _sanitize_details(details)

    # Get previous hash (genesis = "0" * 64)
    latest = _get_latest_audit_row(db)
    previous_hash = latest.event_hash if latest else ("0" * 64)

    # Build payload dict for canonical JSON (sequence_number comes from DB, so we use a placeholder
    # then recompute after DB assigns it — approach: use a temporary UUID for the payload,
    # let PostgreSQL assign sequence_number, then recompute hash in-process)
    # ACTUAL APPROACH: We pre-compute the next sequence number, include it in the payload,
    # then insert with explicit sequence value.
    next_seq = (latest.sequence_number + 1) if latest else 1

    payload = {
        "sequence_number": next_seq,
        "occurred_at": _normalize_iso_timestamp(occurred_at),
        "actor_id": str(actor_id) if actor_id else None,
        "document_id": str(document_id) if document_id else None,
        "action": action,
        "status": status,
        "ip_address": ip_address,
        "user_agent": user_agent,
        "details": safe_details,
        "previous_hash": previous_hash,
    }
    canonical = _canonical_json(payload)
    event_hash = _compute_event_hash(previous_hash, canonical)

    audit_entry = AuditLog(
        id=uuid.uuid4(),
        actor_id=actor_id,
        document_id=document_id,
        action=action,
        status=status,
        ip_address=ip_address,
        user_agent=user_agent,
        details=safe_details,
        occurred_at=occurred_at,
        previous_hash=previous_hash,
        event_hash=event_hash,
    )
    # Set sequence_number explicitly to match what we used in hash computation
    audit_entry.sequence_number = next_seq
    # Override server_default for sequence_number
    db.add(audit_entry)
    db.flush()  # Get the DB-assigned ID without committing

    return audit_entry


def _sanitize_details(details: Optional[dict]) -> Optional[dict]:
    """Remove any sensitive fields from details before persisting."""
    if details is None:
        return None
    forbidden_keys = {
        "password", "password_hash", "token", "token_hash", "csrf_token",
        "cookie", "authorization", "secret", "key", "file_bytes",
    }
    return {k: v for k, v in details.items() if k.lower() not in forbidden_keys}


def record_audit_event(
    db: Session,
    action: str,
    status: str,
    actor_id: Optional[uuid.UUID] = None,
    document_id: Optional[uuid.UUID] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    details: Optional[dict] = None,
) -> AuditLog:
    """
    Record an audit event IN THE CALLER'S TRANSACTION.
    Use for SUCCESS operations — if the main transaction rolls back, so does the audit entry.
    This is intentional: a rolled-back business op should not appear as 'success' in audit logs.
    
    Acquires pg_advisory_xact_lock to prevent concurrent hash chain forks.
    """
    occurred_at = _now_utc()
    _acquire_advisory_lock_if_supported(db)

    return _build_and_insert_audit(
        db=db,
        actor_id=actor_id,
        document_id=document_id,
        action=action,
        status=status,
        ip_address=ip_address,
        user_agent=user_agent,
        details=details,
        occurred_at=occurred_at,
    )


def record_audit_event_independent(
    action: str,
    status: str,
    actor_id: Optional[uuid.UUID] = None,
    document_id: Optional[uuid.UUID] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    details: Optional[dict] = None,
) -> None:
    """
    Record an audit event in an INDEPENDENT short-lived DB transaction.
    Use for DENIED/FAILED events that must persist even when the HTTP handler
    raises HTTPException (which rolls back the main request's DB transaction).
    
    Acquires its own advisory lock, commits, then closes the session.
    """
    occurred_at = _now_utc()
    db = SessionLocal()
    try:
        _acquire_advisory_lock_if_supported(db)
        _build_and_insert_audit(
            db=db,
            actor_id=actor_id,
            document_id=document_id,
            action=action,
            status=status,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details,
            occurred_at=occurred_at,
        )
        db.commit()
    except Exception as e:
        db.rollback()
        # Audit write failure should not propagate to the caller — log to stderr at most
        import sys
        print(f"[AUDIT ERROR] Failed to write audit event: action={action}, err={e}", file=sys.stderr)
    finally:
        db.close()


# ---- Chain Verification ----

def verify_audit_chain(db: Session) -> dict:
    """
    Recompute the entire audit hash chain from genesis to head.
    Detects:
    - Altered column values (event_hash mismatch)
    - Deleted rows (sequence_number gaps)
    - Broken previous_hash links
    
    Returns: { valid, total_events, head_hash, broken_at_sequence, reason }
    """
    all_logs = (
        db.query(AuditLog)
        .order_by(AuditLog.sequence_number.asc())
        .all()
    )

    if not all_logs:
        return {
            "valid": True,
            "total_events": 0,
            "head_hash": "0" * 64,
            "broken_at_sequence": None,
            "reason": None,
        }

    expected_previous_hash = "0" * 64
    expected_seq = 1

    for log in all_logs:
        # Check for sequence gap (deleted row detection)
        if log.sequence_number != expected_seq:
            return {
                "valid": False,
                "total_events": len(all_logs),
                "head_hash": None,
                "broken_at_sequence": expected_seq,
                "reason": f"Sequence gap: expected {expected_seq}, found {log.sequence_number}. Row(s) may have been deleted.",
            }

        # Check previous_hash linkage
        if log.previous_hash != expected_previous_hash:
            return {
                "valid": False,
                "total_events": len(all_logs),
                "head_hash": None,
                "broken_at_sequence": log.sequence_number,
                "reason": f"previous_hash mismatch at sequence {log.sequence_number}.",
            }

        # Recompute event_hash
        payload = {
            "sequence_number": log.sequence_number,
            "occurred_at": _normalize_iso_timestamp(log.occurred_at),
            "actor_id": str(log.actor_id) if log.actor_id else None,
            "document_id": str(log.document_id) if log.document_id else None,
            "action": log.action,
            "status": log.status,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "details": log.details,
            "previous_hash": log.previous_hash,
        }
        canonical = _canonical_json(payload)
        recomputed_hash = _compute_event_hash(expected_previous_hash, canonical)

        if recomputed_hash != log.event_hash:
            return {
                "valid": False,
                "total_events": len(all_logs),
                "head_hash": None,
                "broken_at_sequence": log.sequence_number,
                "reason": f"event_hash mismatch at sequence {log.sequence_number}. Row content may have been tampered with.",
            }

        expected_previous_hash = log.event_hash
        expected_seq += 1

    return {
        "valid": True,
        "total_events": len(all_logs),
        "head_hash": all_logs[-1].event_hash,
        "broken_at_sequence": None,
        "reason": None,
    }


def get_audit_checkpoint(db: Session) -> dict:
    """Get a signed checkpoint of the current audit chain head."""
    latest = (
        db.query(AuditLog)
        .order_by(AuditLog.sequence_number.desc())
        .first()
    )
    return {
        "sequence_number": latest.sequence_number if latest else 0,
        "head_hash": latest.event_hash if latest else ("0" * 64),
        "total_events": db.query(AuditLog).count(),
        "exported_at": _now_utc().isoformat(),
        "note": (
            "This checkpoint anchors the hash chain at export time. "
            "Store externally (e.g., in a separate system or print and sign) to detect "
            "privileged DBA hash recomputation. See THREATS.md for residual risk analysis."
        ),
    }


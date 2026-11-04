"""
TrustVault — Audit Log Model
Implements tamper-evident SHA-256 hash chain.

CRITICAL DESIGN:
- sequence_number (BIGSERIAL) guarantees ordering even when two events share the same microsecond timestamp
- event_hash = SHA-256( previous_hash + "|" + canonical_json )
- previous_hash chains to prior row's event_hash (genesis row uses "0"*64)
- NEVER edit or delete audit rows — the chain verification will detect it
- audit_logs writes are NEVER recursive (reading audit logs does NOT create more audit logs)
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    BigInteger, String, Text, DateTime, ForeignKey, func,
    Index, Sequence, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.db.base import Base

# Sequence definition
audit_seq = Sequence("audit_logs_sequence_number_seq", start=1, increment=1)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sequence_number: Mapped[int] = mapped_column(
        BigInteger,
        unique=True,
        nullable=False,
        index=True,
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, index=True  # "success" | "denied"
    )
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # JSON details — sanitized; portable between PostgreSQL JSONB and SQLite JSON
    details: Mapped[dict | None] = mapped_column(
        JSONB().with_variant(JSON, "sqlite"), nullable=True
    )
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # Hash chain fields
    previous_hash: Mapped[str] = mapped_column(
        String(64), nullable=False  # "0"*64 for genesis event
    )
    event_hash: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False
    )

    # Relationships
    actor: Mapped["User | None"] = relationship("User", foreign_keys=[actor_id])
    document: Mapped["Document | None"] = relationship("Document", back_populates="audit_logs")

    def __repr__(self) -> str:
        return f"<AuditLog seq={self.sequence_number} action={self.action} status={self.status}>"


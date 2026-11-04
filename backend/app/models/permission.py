"""
TrustVault — Document Permission Model
CRITICAL: Partial unique index on (document_id, user_id) WHERE revoked_at IS NULL
prevents concurrent duplicate active grants (race condition protection).
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    String, DateTime, ForeignKey, func,
    Index, CheckConstraint, Enum as SAEnum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base


class DocumentPermission(Base):
    __tablename__ = "document_permissions"

    __table_args__ = (
        CheckConstraint("permission IN ('read', 'edit')", name="ck_permission_values"),
        # CRITICAL partial unique index: prevents duplicate active grants for same user+document
        # This is defined in Alembic migration as a raw DDL index (not a UniqueConstraint)
        # because SQLAlchemy UniqueConstraint doesn't support partial (WHERE) clause.
        # See: migrations/versions/001_initial.py for the actual DDL.
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    permission: Mapped[str] = mapped_column(
        SAEnum("read", "edit", name="permission_enum"), nullable=False
    )
    granted_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    document: Mapped["Document"] = relationship("Document", back_populates="permissions")
    grantee: Mapped["User"] = relationship(
        "User", foreign_keys=[user_id], back_populates="permissions_held"
    )
    granter: Mapped["User"] = relationship(
        "User", foreign_keys=[granted_by], back_populates="permissions_granted"
    )

    def __repr__(self) -> str:
        return f"<DocumentPermission doc={self.document_id} user={self.user_id} perm={self.permission}>"


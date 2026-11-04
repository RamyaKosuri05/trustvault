"""
TrustVault — Storage Blob Model
Used by PostgresPrivateStorage for container environments with ephemeral disks.
Accessed exclusively via storage_service — NEVER joined or exposed in metadata queries.
"""
from __future__ import annotations

from datetime import datetime
from sqlalchemy import DateTime, LargeBinary, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StorageBlob(Base):
    __tablename__ = "storage_blobs"

    storage_key: Mapped[str] = mapped_column(String(255), primary_key=True)
    blob_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


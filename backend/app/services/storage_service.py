"""
TrustVault — Storage Service
Provides a storage abstraction with LocalPrivateStorage and S3PrivateStorage backends.

SECURITY INVARIANTS:
- Files are NEVER served from a web-accessible static mount
- Storage keys are opaque random UUIDs — never derived from filenames
- LocalPrivateStorage uses OS-level 0600/0700 permissions
- S3PrivateStorage uses server-side streaming (get_object) — NEVER presigned URLs
- storage_key is NEVER returned in API JSON responses
"""
from __future__ import annotations

import hashlib
import os
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Generator, Iterator, Optional

from app.core.config import settings

CHUNK_SIZE = 65536  # 64 KB chunks for streaming
REVOCATION_CHECK_CHUNKS = 16  # Check revocation every 16 chunks (every ~1 MB)


class StorageBackend(ABC):
    """Abstract storage backend interface."""

    @abstractmethod
    def put(self, storage_key: str, file_bytes: bytes) -> None:
        """Store file bytes under the given opaque storage key."""
        ...

    @abstractmethod
    def stream(self, storage_key: str) -> Iterator[bytes]:
        """Stream file bytes in CHUNK_SIZE chunks."""
        ...

    @abstractmethod
    def delete(self, storage_key: str) -> None:
        """Delete the file. Best-effort — log errors but don't raise."""
        ...

    @abstractmethod
    def exists(self, storage_key: str) -> bool:
        """Check if the storage key exists."""
        ...

    def generate_key(self) -> str:
        """Generate a new opaque random storage key (UUIDv4)."""
        return str(uuid.uuid4())


class LocalPrivateStorage(StorageBackend):
    """
    Local filesystem storage with private permissions.
    Files stored outside web root, permissions set to 0600.
    Storage root directory is set to 0700.
    """

    def __init__(self, storage_root: str):
        self.storage_root = Path(storage_root).resolve()
        self.storage_root.mkdir(parents=True, exist_ok=True)
        # Set directory to owner-only (rwx------)
        try:
            os.chmod(self.storage_root, 0o700)
        except OSError:
            pass  # Windows doesn't support Unix permissions — acceptable for dev

    def _path(self, storage_key: str) -> Path:
        # SECURITY: storage_key must be a plain UUID (no path components)
        # Validate key format to prevent any path traversal
        safe_key = os.path.basename(storage_key)
        if not safe_key or safe_key != storage_key:
            raise ValueError(f"Invalid storage key: {storage_key!r}")
        return self.storage_root / safe_key

    def put(self, storage_key: str, file_bytes: bytes) -> None:
        path = self._path(storage_key)
        path.write_bytes(file_bytes)
        try:
            os.chmod(path, 0o600)  # Owner-read-write only
        except OSError:
            pass

    def stream(self, storage_key: str) -> Iterator[bytes]:
        path = self._path(storage_key)
        with open(path, "rb") as f:
            while True:
                chunk = f.read(CHUNK_SIZE)
                if not chunk:
                    break
                yield chunk

    def delete(self, storage_key: str) -> None:
        try:
            path = self._path(storage_key)
            if path.exists():
                path.unlink()
        except Exception as e:
            import sys
            print(f"[STORAGE] Failed to delete {storage_key}: {e}", file=sys.stderr)

    def exists(self, storage_key: str) -> bool:
        try:
            return self._path(storage_key).exists()
        except ValueError:
            return False


class S3PrivateStorage(StorageBackend):
    """
    S3 private storage using server-side boto3 streaming.
    NEVER issues presigned URLs to clients.
    All file content flows through the backend application server.
    """

    def __init__(self, bucket: str, region: str):
        import boto3
        self.bucket = bucket
        self.s3 = boto3.client(
            "s3",
            region_name=region,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
        )

    def put(self, storage_key: str, file_bytes: bytes) -> None:
        self.s3.put_object(
            Bucket=self.bucket,
            Key=storage_key,
            Body=file_bytes,
            # Explicitly block all public access at object level
            ACL="private",
        )

    def stream(self, storage_key: str) -> Iterator[bytes]:
        response = self.s3.get_object(Bucket=self.bucket, Key=storage_key)
        body = response["Body"]
        while True:
            chunk = body.read(CHUNK_SIZE)
            if not chunk:
                break
            yield chunk

    def delete(self, storage_key: str) -> None:
        try:
            self.s3.delete_object(Bucket=self.bucket, Key=storage_key)
        except Exception as e:
            import sys
            print(f"[STORAGE/S3] Failed to delete {storage_key}: {e}", file=sys.stderr)

    def exists(self, storage_key: str) -> bool:
        try:
            self.s3.head_object(Bucket=self.bucket, Key=storage_key)
            return True
        except Exception:
            return False


class PostgresPrivateStorage(StorageBackend):
    """
    PostgreSQL LargeBinary/BYTEA storage backend for container environments
    where local disk is ephemeral (e.g. Render container tier without persistent disk).
    Accessed exclusively via storage_service — never joined in metadata queries.
    """

    def __init__(self, session_factory=None):
        if session_factory is None:
            from app.db.session import SessionLocal
            self.session_factory = SessionLocal
        else:
            self.session_factory = session_factory

    def put(self, storage_key: str, file_bytes: bytes) -> None:
        from app.models.storage_blob import StorageBlob
        db = self.session_factory()
        try:
            existing = db.query(StorageBlob).filter(StorageBlob.storage_key == storage_key).first()
            if existing:
                existing.blob_data = file_bytes
            else:
                blob = StorageBlob(storage_key=storage_key, blob_data=file_bytes)
                db.add(blob)
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def stream(self, storage_key: str) -> Iterator[bytes]:
        import io
        from app.models.storage_blob import StorageBlob
        db = self.session_factory()
        try:
            blob = db.query(StorageBlob).filter(StorageBlob.storage_key == storage_key).first()
            if not blob or not blob.blob_data:
                raise FileNotFoundError(f"Storage blob not found for key: {storage_key}")
            data = blob.blob_data
        finally:
            db.close()

        stream = io.BytesIO(data)
        while True:
            chunk = stream.read(CHUNK_SIZE)
            if not chunk:
                break
            yield chunk

    def delete(self, storage_key: str) -> None:
        from app.models.storage_blob import StorageBlob
        db = self.session_factory()
        try:
            db.query(StorageBlob).filter(StorageBlob.storage_key == storage_key).delete()
            db.commit()
        except Exception as e:
            db.rollback()
            import sys
            print(f"[STORAGE/POSTGRES] Failed to delete blob {storage_key}: {e}", file=sys.stderr)
        finally:
            db.close()

    def exists(self, storage_key: str) -> bool:
        from app.models.storage_blob import StorageBlob
        db = self.session_factory()
        try:
            return db.query(StorageBlob.storage_key).filter(StorageBlob.storage_key == storage_key).first() is not None
        finally:
            db.close()


def get_storage_backend() -> StorageBackend:
    """Factory — returns configured storage backend based on STORAGE_BACKEND env var."""
    backend = settings.STORAGE_BACKEND.lower()
    if backend == "s3":
        return S3PrivateStorage(
            bucket=settings.AWS_S3_BUCKET,
            region=settings.AWS_S3_REGION,
        )
    elif backend in ("postgres", "postgresql"):
        return PostgresPrivateStorage()
    else:
        return LocalPrivateStorage(settings.LOCAL_STORAGE_PATH)


# Singleton instance
_storage: Optional[StorageBackend] = None


def get_storage() -> StorageBackend:
    """Get or create the storage backend singleton."""
    global _storage
    if _storage is None:
        _storage = get_storage_backend()
    return _storage


# ---- File checksum computation ----

def compute_sha256_streaming(file_bytes: bytes) -> str:
    """Compute SHA-256 hex digest of file bytes."""
    h = hashlib.sha256()
    h.update(file_bytes)
    return h.hexdigest()


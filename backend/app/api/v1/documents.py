"""
TrustVault — Document Routes
Full CRUD + download + versioning for documents.
Every operation passes through authorize_document_access().
"""
from __future__ import annotations

import math
import uuid
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

from fastapi import (
    APIRouter, Depends, File, Form, HTTPException,
    Query, Request, UploadFile, status
)
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, and_, select
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_current_user, get_db, get_request_meta
from app.models.document import Document
from app.models.document_version import DocumentVersion
from app.models.permission import DocumentPermission
from app.models.user import User
from app.schemas import (
    DocumentResponse, DocumentUpdateRequest, DocumentVersionResponse,
    PaginatedResponse,
)
from app.services.audit_service import record_audit_event, record_audit_event_independent
from app.services.authorization_service import (
    authorize_document_access, check_mid_stream_revocation,
)
from app.services.document_service import validate_upload
from app.services.storage_service import compute_sha256_streaming, get_storage

router = APIRouter(prefix="/documents", tags=["Documents"])

CHUNK_REVOCATION_CHECK_INTERVAL = 16  # Every 16 chunks (~1MB)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _build_doc_response(doc: Document, user: User, db: Session) -> DocumentResponse:
    """Build a DocumentResponse with enriched fields, respecting what the user can access."""
    is_owner = doc.owner_id == user.id

    # Determine user's permission level
    if is_owner:
        user_permission = "owner"
        can_download = True
    elif user.role == "admin":
        user_permission = "metadata_only"
        can_download = False  # Admin cannot download without explicit grant
    else:
        grant = db.query(DocumentPermission).filter(
            DocumentPermission.document_id == doc.id,
            DocumentPermission.user_id == user.id,
            DocumentPermission.revoked_at.is_(None),
            or_(
                DocumentPermission.expires_at.is_(None),
                DocumentPermission.expires_at > _now_utc(),
            ),
        ).first()
        if grant:
            user_permission = grant.permission
            can_download = True
        else:
            user_permission = None
            can_download = False

    return DocumentResponse(
        id=doc.id,
        name=doc.name,
        description=doc.description,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        file_extension=doc.file_extension,
        file_size=doc.file_size,
        checksum_sha256=doc.checksum_sha256,
        version_number=doc.version_number,
        owner_id=doc.owner_id,
        category_id=doc.category_id,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        owner_name=doc.owner.full_name if doc.owner else None,
        category_name=doc.category.name if doc.category else None,
        can_download=can_download,
        user_permission=user_permission,
    )


@router.post("/upload", response_model=DocumentResponse, status_code=201)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    name: str = Form(..., min_length=1, max_length=255),
    description: Optional[str] = Form(None),
    category_id: Optional[uuid.UUID] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    meta: dict = Depends(get_request_meta),
):
    """
    Upload a new document. Owner role only.
    6-layer file validation pipeline applied before any DB write.
    Atomic storage + DB commit with orphan cleanup on failure.
    """
    if user.role not in ("owner",):
        record_audit_event_independent(
            action="DOCUMENT_UPLOAD_DENIED",
            status="denied",
            actor_id=user.id,
            ip_address=meta.get("ip_address"),
            user_agent=meta.get("user_agent"),
            details={"reason": "not_owner_role", "user_role": user.role},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only users with the 'owner' role can upload documents.",
        )

    # Validate upload (6-layer pipeline)
    try:
        file_bytes, sanitized_filename, ext, mime_type = await validate_upload(file)
    except HTTPException as e:
        record_audit_event_independent(
            action="FILE_VALIDATION_REJECTED",
            status="denied",
            actor_id=user.id,
            ip_address=meta.get("ip_address"),
            user_agent=meta.get("user_agent"),
            details={
                "filename": file.filename,
                "reason": e.detail,
                "content_type": file.content_type,
            },
        )
        raise

    # Generate opaque storage key (UUID — completely unrelated to filename)
    storage = get_storage()
    storage_key = storage.generate_key()
    checksum = compute_sha256_streaming(file_bytes)

    # Atomic write: store file first, then commit DB
    # If DB fails, delete orphaned file in finally block
    storage_written = False
    doc_id = uuid.uuid4()
    try:
        storage.put(storage_key, file_bytes)
        storage_written = True

        doc = Document(
            id=doc_id,
            owner_id=user.id,
            category_id=category_id,
            name=name.strip(),
            description=description,
            original_filename=sanitized_filename,
            storage_key=storage_key,
            mime_type=mime_type,
            file_extension=ext,
            file_size=len(file_bytes),
            checksum_sha256=checksum,
            version_number=1,
        )
        db.add(doc)

        record_audit_event(
            db=db,
            action="DOCUMENT_UPLOAD",
            status="success",
            actor_id=user.id,
            document_id=doc_id,
            ip_address=meta.get("ip_address"),
            user_agent=meta.get("user_agent"),
            details={
                "filename": sanitized_filename,
                "size_bytes": len(file_bytes),
                "mime_type": mime_type,
                "checksum_sha256": checksum,
            },
        )

        db.commit()
        db.refresh(doc)
        # Eagerly load relationships for response
        db.refresh(doc)
        return _build_doc_response(doc, user, db)

    except Exception:
        db.rollback()
        # Orphan cleanup — delete the file we already wrote to storage
        if storage_written:
            storage.delete(storage_key)
        raise


@router.get("", response_model=PaginatedResponse[DocumentResponse])
async def list_documents(
    request: Request,
    q: Optional[str] = Query(None, description="Name search"),
    owner_name: Optional[str] = Query(None),
    category_id: Optional[uuid.UUID] = Query(None),
    file_type: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    scope: Optional[str] = Query(None, pattern="^(owned|shared|all)?$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    meta: dict = Depends(get_request_meta),
):
    """
    List documents accessible to the current user.
    AUTHORIZATION FILTER APPLIED IN SQL BEFORE ANY SEARCH/PAGINATION.
    - Owner: sees own documents + documents shared with them
    - Viewer: sees ONLY documents actively shared with them
    - Admin: sees org-wide metadata inventory (can_download=False unless granted)
    """
    now = _now_utc()
    query = (
        db.query(Document)
        .filter(Document.deleted_at.is_(None))
        .options(joinedload(Document.owner), joinedload(Document.category))
    )

    # --- CRITICAL: Apply authorization filter BEFORE search/pagination ---
    if user.role == "admin":
        # Admin sees all non-deleted documents (metadata only)
        pass  # No additional filter needed — will mark can_download=False in response

    elif user.role == "owner":
        if scope == "owned":
            query = query.filter(Document.owner_id == user.id)
        elif scope == "shared":
            # Documents shared with this owner by others
            shared_ids = (
                select(DocumentPermission.document_id)
                .where(
                    DocumentPermission.user_id == user.id,
                    DocumentPermission.revoked_at.is_(None),
                    or_(
                        DocumentPermission.expires_at.is_(None),
                        DocumentPermission.expires_at > now,
                    ),
                )
            )
            query = query.filter(Document.id.in_(shared_ids))
        else:
            # Default: owned + shared
            shared_ids = (
                select(DocumentPermission.document_id)
                .where(
                    DocumentPermission.user_id == user.id,
                    DocumentPermission.revoked_at.is_(None),
                    or_(
                        DocumentPermission.expires_at.is_(None),
                        DocumentPermission.expires_at > now,
                    ),
                )
            )
            query = query.filter(
                or_(
                    Document.owner_id == user.id,
                    Document.id.in_(shared_ids),
                )
            )

    else:  # viewer
        # Viewers can ONLY see documents with active, non-expired grants
        active_grant_ids = (
            select(DocumentPermission.document_id)
            .where(
                DocumentPermission.user_id == user.id,
                DocumentPermission.revoked_at.is_(None),
                or_(
                    DocumentPermission.expires_at.is_(None),
                    DocumentPermission.expires_at > now,
                ),
            )
        )
        query = query.filter(Document.id.in_(active_grant_ids))

    # --- Apply search/filter AFTER authorization filter ---
    if q:
        query = query.filter(Document.name.ilike(f"%{q}%"))
    if category_id:
        query = query.filter(Document.category_id == category_id)
    if file_type:
        query = query.filter(Document.file_extension == file_type.lower())
    if date_from:
        query = query.filter(Document.created_at >= date_from)
    if date_to:
        query = query.filter(Document.created_at <= date_to)

    total = query.count()
    offset = (page - 1) * page_size
    docs = query.order_by(Document.updated_at.desc()).offset(offset).limit(page_size).all()

    return PaginatedResponse(
        items=[_build_doc_response(doc, user, db) for doc in docs],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    meta: dict = Depends(get_request_meta),
):
    """Get document metadata. Requires at least read access (or metadata_admin_or_grant for admin)."""
    perm = "metadata_admin_or_grant" if user.role == "admin" else "read"
    doc = authorize_document_access(
        db=db, user=user, document_id=document_id,
        required_permission=perm,
        action_name="DOCUMENT_VIEW",
        request_meta=meta,
    )

    record_audit_event(
        db=db, action="DOCUMENT_VIEW", status="success",
        actor_id=user.id, document_id=doc.id,
        ip_address=meta.get("ip_address"), user_agent=meta.get("user_agent"),
        details={"document_name": doc.name},
    )
    db.commit()

    # Eager load for response
    db.refresh(doc)
    return _build_doc_response(doc, user, db)


@router.get("/{document_id}/download")
async def download_document(
    document_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    meta: dict = Depends(get_request_meta),
):
    """
    Stream document file bytes. Requires read access.
    Admin role CANNOT download without explicit grant (403).
    Mid-stream revocation check every CHUNK_REVOCATION_CHECK_INTERVAL chunks.
    
    Security headers:
    - Content-Disposition: attachment (NEVER inline)
    - Cache-Control: private, no-store
    - X-Content-Type-Options: nosniff
    - CSP: default-src 'none'; sandbox
    """
    doc = authorize_document_access(
        db=db, user=user, document_id=document_id,
        required_permission="read",
        action_name="DOCUMENT_DOWNLOAD",
        request_meta=meta,
    )

    record_audit_event(
        db=db, action="DOCUMENT_DOWNLOAD", status="success",
        actor_id=user.id, document_id=doc.id,
        ip_address=meta.get("ip_address"), user_agent=meta.get("user_agent"),
        details={"document_name": doc.name, "file_size": doc.file_size},
    )
    db.commit()

    storage = get_storage()
    storage_key = doc.storage_key
    doc_id = doc.id
    doc_name = doc.original_filename
    mime = doc.mime_type

    # Sanitize filename for Content-Disposition header
    ascii_filename = "".join(c if ord(c) < 128 and c not in '"\\' else "_" for c in doc_name)
    encoded_filename = quote(doc_name)

    def generate_chunks():
        chunk_count = 0
        try:
            for chunk in storage.stream(storage_key):
                chunk_count += 1

                # Mid-stream revocation check every N chunks
                if chunk_count % CHUNK_REVOCATION_CHECK_INTERVAL == 0:
                    if not check_mid_stream_revocation(db, user, doc_id, meta):
                        record_audit_event_independent(
                            action="DOWNLOAD_ABORTED_REVOKED",
                            status="denied",
                            actor_id=user.id,
                            document_id=doc_id,
                            ip_address=meta.get("ip_address"),
                            user_agent=meta.get("user_agent"),
                            details={
                                "reason": "permission_revoked_mid_stream",
                                "chunks_sent": chunk_count,
                            },
                        )
                        return  # Abort streaming (closes generator)

                yield chunk
        except Exception:
            return

    return StreamingResponse(
        generate_chunks(),
        media_type=mime,
        headers={
            "Content-Disposition": f'attachment; filename="{ascii_filename}"; filename*=UTF-8\'\'{encoded_filename}',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
            "Content-Security-Policy": "default-src 'none'; sandbox",
        },
    )


@router.patch("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: uuid.UUID,
    body: DocumentUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    meta: dict = Depends(get_request_meta),
):
    """Update document metadata. Requires edit access or ownership."""
    doc = authorize_document_access(
        db=db, user=user, document_id=document_id,
        required_permission="edit",
        action_name="DOCUMENT_UPDATE",
        request_meta=meta,
    )

    changes = {}
    if body.name is not None:
        changes["name"] = {"from": doc.name, "to": body.name}
        doc.name = body.name
    if body.description is not None:
        changes["description_updated"] = True
        doc.description = body.description
    if body.category_id is not None:
        changes["category_id"] = {"from": str(doc.category_id), "to": str(body.category_id)}
        doc.category_id = body.category_id

    record_audit_event(
        db=db, action="DOCUMENT_UPDATE", status="success",
        actor_id=user.id, document_id=doc.id,
        ip_address=meta.get("ip_address"), user_agent=meta.get("user_agent"),
        details={"changes": changes},
    )
    db.commit()
    db.refresh(doc)
    return _build_doc_response(doc, user, db)


@router.put("/{document_id}/file", response_model=DocumentResponse)
async def upload_new_version(
    document_id: uuid.UUID,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    meta: dict = Depends(get_request_meta),
):
    """Upload a new file version. Requires edit access or ownership."""
    doc = authorize_document_access(
        db=db, user=user, document_id=document_id,
        required_permission="edit",
        action_name="DOCUMENT_VERSION_UPLOAD",
        request_meta=meta,
    )

    try:
        file_bytes, sanitized_filename, ext, mime_type = await validate_upload(file)
    except HTTPException as e:
        record_audit_event_independent(
            action="FILE_VALIDATION_REJECTED",
            status="denied",
            actor_id=user.id,
            document_id=doc.id,
            ip_address=meta.get("ip_address"),
            user_agent=meta.get("user_agent"),
            details={"filename": file.filename, "reason": e.detail},
        )
        raise

    storage = get_storage()
    new_storage_key = storage.generate_key()
    checksum = compute_sha256_streaming(file_bytes)
    old_storage_key = doc.storage_key

    storage_written = False
    try:
        storage.put(new_storage_key, file_bytes)
        storage_written = True

        # Archive current version
        version_entry = DocumentVersion(
            id=uuid.uuid4(),
            document_id=doc.id,
            version_number=doc.version_number,
            uploaded_by=user.id,
            storage_key=old_storage_key,
            original_filename=doc.original_filename,
            mime_type=doc.mime_type,
            file_size=doc.file_size,
            checksum_sha256=doc.checksum_sha256,
        )
        db.add(version_entry)

        # Update document to new version
        doc.storage_key = new_storage_key
        doc.original_filename = sanitized_filename
        doc.mime_type = mime_type
        doc.file_extension = ext
        doc.file_size = len(file_bytes)
        doc.checksum_sha256 = checksum
        doc.version_number += 1

        record_audit_event(
            db=db, action="DOCUMENT_VERSION_UPLOAD", status="success",
            actor_id=user.id, document_id=doc.id,
            ip_address=meta.get("ip_address"), user_agent=meta.get("user_agent"),
            details={
                "new_version": doc.version_number,
                "filename": sanitized_filename,
                "size_bytes": len(file_bytes),
                "checksum_sha256": checksum,
            },
        )

        db.commit()
        db.refresh(doc)
        return _build_doc_response(doc, user, db)

    except Exception:
        db.rollback()
        if storage_written:
            storage.delete(new_storage_key)
        raise


@router.get("/{document_id}/versions", response_model=list[DocumentVersionResponse])
async def get_versions(
    document_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    meta: dict = Depends(get_request_meta),
):
    """Get version history for a document. Requires read access."""
    doc = authorize_document_access(
        db=db, user=user, document_id=document_id,
        required_permission="read",
        action_name="DOCUMENT_VERSIONS_VIEW",
        request_meta=meta,
    )

    versions = (
        db.query(DocumentVersion)
        .filter(DocumentVersion.document_id == doc.id)
        .order_by(DocumentVersion.version_number.asc())
        .all()
    )
    return versions


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    meta: dict = Depends(get_request_meta),
):
    """
    Soft-delete a document. Owner only.
    Sets deleted_at = now(), revokes all active grants.
    """
    doc = authorize_document_access(
        db=db, user=user, document_id=document_id,
        required_permission="owner",
        action_name="DOCUMENT_DELETE",
        request_meta=meta,
    )

    now = _now_utc()
    doc.deleted_at = now

    # Revoke all active permission grants on this document
    active_grants = (
        db.query(DocumentPermission)
        .filter(
            DocumentPermission.document_id == doc.id,
            DocumentPermission.revoked_at.is_(None),
        )
        .all()
    )
    for grant in active_grants:
        grant.revoked_at = now

    record_audit_event(
        db=db, action="DOCUMENT_DELETE", status="success",
        actor_id=user.id, document_id=doc.id,
        ip_address=meta.get("ip_address"), user_agent=meta.get("user_agent"),
        details={
            "document_name": doc.name,
            "grants_revoked": len(active_grants),
        },
    )
    db.commit()


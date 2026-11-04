"""
TrustVault — Pydantic v2 Schemas
All request/response models with strict validation.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

# ---- Generic Response Envelope ----

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class ErrorResponse(BaseModel):
    error: str
    message: str
    details: Optional[Any] = None


# ---- Auth Schemas ----

class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=10, max_length=128)
    role: str = Field(default="viewer")

    @field_validator("full_name")
    @classmethod
    def strip_full_name(cls, v: str) -> str:
        return v.strip()

    @field_validator("role")
    @classmethod
    def role_must_not_be_admin(cls, v: str) -> str:
        normalized = v.lower().strip()
        if normalized == "admin":
            raise ValueError("Cannot register as admin. Admin accounts are provisioned by administrators.")
        if normalized not in ("owner", "viewer"):
            raise ValueError("Role must be 'owner' or 'viewer'.")
        return normalized

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower().strip()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower().strip()


class LoginResponse(BaseModel):
    csrf_token: str
    user: "UserResponse"
    message: str = "Login successful."


class LogoutResponse(BaseModel):
    message: str = "Logged out successfully."


# ---- User Schemas ----

class UserResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    full_name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserLookupResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    full_name: str
    email: str
    role: str


class UserStatusUpdateRequest(BaseModel):
    is_active: bool


# ---- Category Schemas ----

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    description: Optional[str] = Field(None, max_length=500)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class CategoryResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    description: Optional[str]
    created_at: datetime


# ---- Document Schemas ----

class DocumentResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    description: Optional[str]
    original_filename: str
    mime_type: str
    file_extension: str
    file_size: int
    checksum_sha256: str
    version_number: int
    owner_id: uuid.UUID
    category_id: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime
    owner_name: Optional[str] = None
    category_name: Optional[str] = None
    can_download: bool = True
    user_permission: Optional[str] = None


class DocumentUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    category_id: Optional[uuid.UUID] = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if v else v


class DocumentVersionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    document_id: uuid.UUID
    version_number: int
    uploaded_by: uuid.UUID
    original_filename: str
    mime_type: str
    file_size: int
    checksum_sha256: str
    created_at: datetime


# ---- Permission Schemas ----

class PermissionGrantRequest(BaseModel):
    email: Optional[EmailStr] = None
    user_id: Optional[uuid.UUID] = None
    permission: str = Field(..., pattern="^(read|edit)$")
    expires_at: Optional[datetime] = None

    @model_validator(mode="after")
    def email_or_user_id_required(self) -> "PermissionGrantRequest":
        if not self.email and not self.user_id:
            raise ValueError("Either 'email' or 'user_id' must be provided.")
        return self


class PermissionUpdateRequest(BaseModel):
    permission: Optional[str] = Field(None, pattern="^(read|edit)$")
    expires_at: Optional[datetime] = None


class PermissionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    document_id: uuid.UUID
    user_id: uuid.UUID
    permission: str
    granted_by: uuid.UUID
    expires_at: Optional[datetime]
    granted_at: datetime
    updated_at: datetime
    revoked_at: Optional[datetime]
    grantee_name: Optional[str] = None
    grantee_email: Optional[str] = None
    granter_name: Optional[str] = None


# ---- Audit Schemas ----

class AuditLogResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    sequence_number: int
    actor_id: Optional[uuid.UUID]
    document_id: Optional[uuid.UUID]
    action: str
    status: str
    ip_address: Optional[str]
    user_agent: Optional[str]
    details: Optional[dict]
    occurred_at: datetime
    previous_hash: str
    event_hash: str
    actor_name: Optional[str] = None
    actor_email: Optional[str] = None


class ChainVerificationResponse(BaseModel):
    valid: bool
    total_events: int
    head_hash: Optional[str]
    broken_at_sequence: Optional[int]
    reason: Optional[str]


class AuditCheckpointResponse(BaseModel):
    sequence_number: int
    head_hash: str
    total_events: int
    exported_at: str
    note: str


# ---- Dashboard Schemas ----

class OwnerDashboardResponse(BaseModel):
    total_documents: int
    shared_documents: int
    total_permissions_granted: int
    recent_activity_count: int
    storage_used_bytes: int
    documents_by_category: List[dict]


class ViewerDashboardResponse(BaseModel):
    shared_with_me: int
    read_access_count: int
    edit_access_count: int
    recent_downloads: int


class AdminDashboardResponse(BaseModel):
    total_users: int
    active_users: int
    total_documents: int
    total_audit_events: int
    denied_events_last_24h: int
    failed_logins_last_24h: int
    users_by_role: List[dict]
    chain_valid: bool


# Rebuild models with forward refs
LoginResponse.model_rebuild()


"""
TrustVault — Category Routes
"""
from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, get_request_meta, require_role
from app.models.category import Category
from app.models.user import User
from app.schemas import CategoryCreate, CategoryResponse
from app.services.audit_service import record_audit_event

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=list[CategoryResponse])
async def list_categories(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all categories. Any authenticated active user."""
    return db.query(Category).order_by(Category.name).all()


@router.post("", response_model=CategoryResponse, status_code=201)
async def create_category(
    request: Request,
    body: CategoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
    meta: dict = Depends(get_request_meta),
):
    """Create a new category (admin only)."""
    existing = db.query(Category).filter(Category.name == body.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Category with this name already exists.")

    category = Category(
        id=uuid.uuid4(),
        name=body.name,
        description=body.description,
        created_by=user.id,
    )
    db.add(category)
    record_audit_event(
        db=db, action="CATEGORY_CREATED", status="success",
        actor_id=user.id,
        ip_address=meta.get("ip_address"), user_agent=meta.get("user_agent"),
        details={"name": body.name},
    )
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
    meta: dict = Depends(get_request_meta),
):
    """Delete a category (admin only). Documents in this category will have category set to NULL."""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")

    record_audit_event(
        db=db, action="CATEGORY_DELETED", status="success",
        actor_id=user.id,
        ip_address=meta.get("ip_address"), user_agent=meta.get("user_agent"),
        details={"name": category.name, "category_id": str(category_id)},
    )
    db.delete(category)
    db.commit()


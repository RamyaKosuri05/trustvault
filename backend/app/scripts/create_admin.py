"""
TrustVault — Create Admin Account Script
Provisions an admin account via CLI (never via public registration endpoint).

USAGE:
  cd backend
  python -m app.scripts.create_admin --email admin@example.com --name "Admin User" --password "SecurePass123!"
"""
import argparse
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import User


def create_admin(email: str, full_name: str, password: str):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        normalized_email = email.lower().strip()
        existing = db.query(User).filter(User.email == normalized_email).first()
        if existing:
            print(f"ERROR: User with email {normalized_email} already exists (role: {existing.role}).")
            sys.exit(1)

        admin = User(
            id=uuid.uuid4(),
            full_name=full_name,
            email=normalized_email,
            password_hash=hash_password(password),
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print(f"[SUCCESS] Admin account created: {normalized_email}")
        print(f"   ID: {admin.id}")
        print(f"   Name: {full_name}")
        print(f"   Role: admin")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to create admin: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create a TrustVault admin account")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()
    create_admin(args.email, args.name, args.password)


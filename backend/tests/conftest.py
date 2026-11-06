"""
TrustVault — Test Configuration & Fixtures
Uses in-memory SQLite for unit tests (fast) and PostgreSQL for integration tests.
"""
import os
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

# Use SQLite file for test runs so all connections share the same tables
TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_trustvault.db"))
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    f"sqlite:///{TEST_DB_FILE}"
)

os.environ.setdefault("DATABASE_URL", TEST_DATABASE_URL)
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production-32-chars-min")
os.environ.setdefault("STORAGE_BACKEND", "local")
os.environ.setdefault("LOCAL_STORAGE_PATH", "./test_storage")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")
os.environ.setdefault("ALLOW_DEMO_SEED", "false")
os.environ.setdefault("ENVIRONMENT", "testing")

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.core.security import hash_password
from app.models.user import User
from app.models.session import UserSession
from app.models.category import Category
from app.models.document import Document
from app.models.document_version import DocumentVersion
from app.models.permission import DocumentPermission
from app.models.audit_log import AuditLog
from app.services.storage_service import LocalPrivateStorage


@pytest.fixture(scope="session")
def engine_fixture():
    """Create test database engine."""
    if TEST_DATABASE_URL.startswith("sqlite"):
        engine = create_engine(
            TEST_DATABASE_URL,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        # SQLite: Enable WAL mode and foreign keys
        @event.listens_for(engine, "connect")
        def set_sqlite_pragma(dbapi_conn, connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
    else:
        engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)

    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="function")
def db(engine_fixture):
    """Provide a database session that rolls back after each test."""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_fixture)
    session = TestingSessionLocal()
    yield session
    session.rollback()
    # Clean tables after each test
    for table in reversed(Base.metadata.sorted_tables):
        session.execute(table.delete())
    session.commit()
    session.close()


@pytest.fixture(scope="function")
def client(db):
    """FastAPI test client with overridden DB dependency."""
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    # Disable rate limiter during tests so test suite doesn't hit 429
    from app.core.rate_limit import limiter
    limiter.enabled = False
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    limiter.enabled = True
    app.dependency_overrides.clear()


@pytest.fixture
def storage(tmp_path):
    """Temporary local storage backend for tests."""
    return LocalPrivateStorage(str(tmp_path / "test_storage"))


# ---- Helper: Create Users ----

def make_user(db: Session, email: str, role: str, password: str = "TestPass123!",
              full_name: str = "Test User", is_active: bool = True) -> User:
    user = User(
        id=uuid.uuid4(),
        full_name=full_name,
        email=email,
        password_hash=hash_password(password),
        role=role,
        is_active=is_active,
    )
    db.add(user)
    db.flush()
    return user


def make_document(db: Session, owner: User, name: str = "Test Document",
                  storage_key: str = None, file_bytes: bytes = b"%PDF-test",
                  storage=None) -> Document:
    sk = storage_key or str(uuid.uuid4())
    if storage:
        storage.put(sk, file_bytes)
    doc = Document(
        id=uuid.uuid4(),
        owner_id=owner.id,
        name=name,
        original_filename="test.pdf",
        storage_key=sk,
        mime_type="application/pdf",
        file_extension=".pdf",
        file_size=len(file_bytes),
        checksum_sha256="abc123",
        version_number=1,
    )
    db.add(doc)
    v1 = DocumentVersion(
        id=uuid.uuid4(),
        document_id=doc.id,
        version_number=1,
        uploaded_by=owner.id,
        storage_key=sk,
        original_filename="test.pdf",
        mime_type="application/pdf",
        file_size=len(file_bytes),
        checksum_sha256="abc123",
    )
    db.add(v1)
    db.flush()
    return doc


def make_grant(db: Session, doc: Document, grantee: User, granter: User,
               permission: str = "read") -> DocumentPermission:
    perm = DocumentPermission(
        id=uuid.uuid4(),
        document_id=doc.id,
        user_id=grantee.id,
        permission=permission,
        granted_by=granter.id,
    )
    db.add(perm)
    db.flush()
    return perm


def login_as(client: TestClient, email: str, password: str = "TestPass123!") -> dict:
    """Login and return {'csrf_token': ..., 'cookies': ...}."""
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    data = resp.json()
    return {"csrf_token": data["csrf_token"], "user": data["user"]}


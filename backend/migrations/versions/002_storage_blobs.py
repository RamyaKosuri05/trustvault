"""Add storage_blobs table for PostgresPrivateStorage

Revision ID: 002_storage_blobs
Revises: 001_initial
Create Date: 2026-11-05

Creates dedicated private storage_blobs table for container deployments
where local filesystem storage is ephemeral (e.g. Render free tier).
"""
from alembic import op
import sqlalchemy as sa

revision = "002_storage_blobs"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "storage_blobs",
        sa.Column("storage_key", sa.String(255), nullable=False),
        sa.Column("blob_data", sa.LargeBinary(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("storage_key"),
    )


def downgrade() -> None:
    op.drop_table("storage_blobs")


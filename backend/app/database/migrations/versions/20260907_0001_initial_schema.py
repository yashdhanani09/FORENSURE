"""initial phase one schema

Revision ID: 20260907_0001
Revises:
Create Date: 2026-09-07 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260907_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "devices",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("vendor", sa.String(length=128), nullable=True),
        sa.Column("model", sa.String(length=128), nullable=True),
        sa.Column("serial", sa.String(length=256), nullable=True),
        sa.Column("capacity_bytes", sa.Integer(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_connected", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "operations",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("device_id", sa.String(length=64), nullable=False),
        sa.Column("operation_type", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_operations_device_id", "operations", ["device_id"])
    op.create_table(
        "evidence",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("operation_id", sa.String(length=64), nullable=False),
        sa.Column("case_id", sa.String(length=64), nullable=False),
        sa.Column("path", sa.String(length=512), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["operation_id"], ["operations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_evidence_case_id", "evidence", ["case_id"])
    op.create_index("ix_evidence_operation_id", "evidence", ["operation_id"])
    op.create_table(
        "reports",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("operation_id", sa.String(length=64), nullable=False),
        sa.Column("report_type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("json_path", sa.String(length=512), nullable=True),
        sa.Column("pdf_path", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["operation_id"], ["operations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reports_operation_id", "reports", ["operation_id"])


def downgrade() -> None:
    op.drop_index("ix_reports_operation_id", table_name="reports")
    op.drop_table("reports")
    op.drop_index("ix_evidence_operation_id", table_name="evidence")
    op.drop_index("ix_evidence_case_id", table_name="evidence")
    op.drop_table("evidence")
    op.drop_index("ix_operations_device_id", table_name="operations")
    op.drop_table("operations")
    op.drop_table("devices")


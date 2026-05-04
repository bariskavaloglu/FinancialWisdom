"""Add admin_overrides table

Revision ID: 001_admin_overrides
Revises:
Create Date: 2026-05-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = '001_admin_overrides'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'admin_overrides',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('asset_class', sa.String(50), nullable=False),
        sa.Column('min_weight', sa.Float, nullable=True),
        sa.Column('max_weight', sa.Float, nullable=True),
        sa.Column('reason', sa.Text, nullable=False),
        sa.Column('created_by_admin_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_by_admin_email', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_admin_overrides_user_id', 'admin_overrides', ['user_id'])
    op.create_index('ix_admin_overrides_is_active', 'admin_overrides', ['is_active'])


def downgrade() -> None:
    op.drop_index('ix_admin_overrides_is_active', 'admin_overrides')
    op.drop_index('ix_admin_overrides_user_id', 'admin_overrides')
    op.drop_table('admin_overrides')

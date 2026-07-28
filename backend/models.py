import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, String, Text, Integer, Float, DateTime, ForeignKey, text
from sqlalchemy import inspect
from datetime import datetime, timezone
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in environment variables")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    password_salt = Column(String, nullable=False, default="", server_default="")
    display_name = Column(String, nullable=False)
    role = Column(String, nullable=False, default="analyst")


class AuditLogEntry(Base):
    __tablename__ = "audit_log_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    response_id = Column(String, unique=True, nullable=False)
    timestamp_utc = Column(String, nullable=False)
    source_type = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    user_display_name = Column(String, nullable=False)
    ai_system = Column(String, nullable=False)
    model_version = Column(String, nullable=False)
    input_text = Column(Text, nullable=False)
    input_source = Column(String, nullable=False)
    policy_invoked = Column(String, nullable=False)
    reasoning_summary = Column(Text, nullable=False)
    output_text = Column(Text, nullable=False)
    downstream_action = Column(String, nullable=False)
    parent_response_id = Column(String, nullable=True)
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    cost_per_response = Column(Float, nullable=True)
    prev_hash = Column(String, nullable=False)
    entry_hash = Column(String, nullable=False)


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    token = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


def _migrate_old_schema():
    """Rename decision_id columns to response_id if they still exist."""
    inspector = inspect(engine)
    columns = {c["name"] for c in inspector.get_columns("audit_log_entries")}
    with engine.connect() as conn:
        if "decision_id" in columns:
            conn.execute(text("ALTER TABLE audit_log_entries RENAME COLUMN decision_id TO response_id"))
        if "parent_decision_id" in columns:
            conn.execute(text("ALTER TABLE audit_log_entries RENAME COLUMN parent_decision_id TO parent_response_id"))
        if "cost_per_response" not in columns:
            conn.execute(text("ALTER TABLE audit_log_entries ADD COLUMN cost_per_response DOUBLE PRECISION"))
        conn.commit()


def init_db():
    _migrate_old_schema()
    Base.metadata.create_all(bind=engine)

    from auth import seed_demo_users

    db = SessionLocal()
    try:
        seed_demo_users(db)
    finally:
        db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
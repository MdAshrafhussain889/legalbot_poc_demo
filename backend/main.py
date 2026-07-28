from datetime import datetime, timezone
from typing import Optional
from collections import defaultdict

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import io
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from models import init_db, get_db, AuditLogEntry
from audit_service import create_audit_log_entry, verify_chain
from chat_service import process_chat_message
from export_service import filter_entries, export_as_json, export_as_csv
from review_service import create_review, get_reviews_for_entry
from auth import (
    register_user,
    login_user,
    get_current_user,
    require_audit_access,
    resolve_user_from_authorization,
    RegisterRequest,
    LoginRequest,
    UserResponse,
)
from pricing import MODEL_PRICING

load_dotenv()

app = FastAPI(title="AI Audit Trail POC")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()


class CreateAuditLogRequest(BaseModel):
    source_type: str
    user_id: str
    user_display_name: str
    ai_system: str
    model_version: str
    input_text: str
    input_source: str
    policy_invoked: str
    reasoning_summary: str
    output_text: str
    downstream_action: str
    parent_response_id: Optional[str] = None


class AuditLogResponse(BaseModel):
    id: int
    response_id: str
    timestamp_utc: str
    source_type: str
    user_id: str
    user_display_name: str
    ai_system: str
    model_version: str
    input_text: str
    input_source: str
    policy_invoked: str
    reasoning_summary: str
    output_text: str
    downstream_action: str
    parent_response_id: Optional[str]
    cost_per_response: Optional[float] = None
    prev_hash: str
    entry_hash: str

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    message: str
    policy_id: str = "general_assistant_v1"


class ChatResponse(BaseModel):
    reply: str
    response_id: str


class ReviewRequest(BaseModel):
    status: str  # "approved" or "flagged"
    comment: str


class DbQueryResponse(BaseModel):
    entries: list[AuditLogResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


class DetectorEventRequest(BaseModel):
    domain: str
    matched_ai_system: str
    tab_title: str
    timestamp_client: str
    user_id: Optional[str] = None
    user_display_name: Optional[str] = None
    user_note: Optional[str] = None


@app.get("/health")
def health():
    return {
        "status": "ok",
        "time_utc": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/auth/register", response_model=dict)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    result = register_user(request, db)
    return {"token": result.token, "user": result.user}


@app.post("/api/auth/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    result = login_user(request, db)
    return {"token": result.token, "user": result.user}


@app.post("/api/chat", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    try:
        result = process_chat_message(
            message=request.message,
            policy_id=request.policy_id,
            current_user=current_user,
            db=db,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to process chat message")


@app.post("/api/audit-logs", response_model=AuditLogResponse)
def create_audit_log(
    request: CreateAuditLogRequest,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_audit_access),
):
    entry = create_audit_log_entry(
        source_type=request.source_type,
        user_id=request.user_id,
        user_display_name=request.user_display_name,
        ai_system=request.ai_system,
        model_version=request.model_version,
        input_text=request.input_text,
        input_source=request.input_source,
        policy_invoked=request.policy_invoked,
        reasoning_summary=request.reasoning_summary,
        output_text=request.output_text,
        downstream_action=request.downstream_action,
        parent_response_id=request.parent_response_id,
        db=db,
    )
    return entry


@app.get("/api/audit-logs", response_model=list[AuditLogResponse])
def list_audit_logs(
    limit: int = 10,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_audit_access),
):
    entries = (
        db.query(AuditLogEntry)
        .order_by(AuditLogEntry.id.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return entries


@app.get("/api/audit-logs/verify")
def verify_audit_chain(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_audit_access),
):
    result = verify_chain(db=db)
    return result


@app.get("/api/db/audit-log-entries", response_model=DbQueryResponse)
def db_view_audit_logs(
    page: int = 1,
    per_page: int = 50,
    sort_by: str = "id",
    sort_dir: str = "desc",
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_audit_access),
):
    allowed_sort_cols = {
        "id", "response_id", "timestamp_utc", "source_type",
        "user_display_name", "ai_system", "model_version",
        "policy_invoked", "downstream_action", "cost_per_response",
    }
    if sort_by not in allowed_sort_cols:
        sort_by = "id"
    sort_col = getattr(AuditLogEntry, sort_by)
    order = sort_col.desc() if sort_dir == "desc" else sort_col.asc()

    query = db.query(AuditLogEntry)
    if search:
        like = f"%{search}%"
        query = query.filter(
            AuditLogEntry.user_display_name.ilike(like)
            | AuditLogEntry.ai_system.ilike(like)
            | AuditLogEntry.source_type.ilike(like)
            | AuditLogEntry.response_id.ilike(like)
            | AuditLogEntry.policy_invoked.ilike(like)
        )
    total = query.count()
    entries = query.order_by(order).offset((page - 1) * per_page).limit(per_page).all()
    return DbQueryResponse(
        entries=entries,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=max(1, (total + per_page - 1) // per_page),
    )


@app.get("/api/audit-logs/cost")
def get_audit_cost(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_audit_access),
):
    query = db.query(AuditLogEntry).filter(
        AuditLogEntry.prompt_tokens.isnot(None),
        AuditLogEntry.completion_tokens.isnot(None),
        AuditLogEntry.source_type != "review_event",
    )
    if from_date:
        query = query.filter(AuditLogEntry.timestamp_utc >= from_date)
    if to_date:
        query = query.filter(AuditLogEntry.timestamp_utc <= to_date)

    entries = query.all()

    model_totals: dict[str, dict] = {}
    total_cost = 0.0
    total_prompt = 0
    total_completion = 0

    for e in entries:
        pricing = MODEL_PRICING.get(e.model_version, {"input": 0.50, "output": 1.50})
        cost = (e.prompt_tokens / 1_000_000 * pricing["input"] +
                e.completion_tokens / 1_000_000 * pricing["output"])
        total_cost += cost
        total_prompt += e.prompt_tokens or 0
        total_completion += e.completion_tokens or 0

        if e.model_version not in model_totals:
            model_totals[e.model_version] = {"model": e.model_version, "cost": 0.0, "prompt_tokens": 0, "completion_tokens": 0}
        model_totals[e.model_version]["cost"] += cost
        model_totals[e.model_version]["prompt_tokens"] += e.prompt_tokens or 0
        model_totals[e.model_version]["completion_tokens"] += e.completion_tokens or 0

    return {
        "total_cost": round(total_cost, 4),
        "total_prompt_tokens": total_prompt,
        "total_completion_tokens": total_completion,
        "by_model": [v for v in sorted(model_totals.values(), key=lambda x: x["cost"], reverse=True)],
    }


@app.get("/api/audit-logs/export")
def export_audit_logs(
    format: str = "json",
    source_type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_audit_access),
):
    if format not in ["json", "csv"]:
        raise HTTPException(status_code=400, detail="Format must be 'json' or 'csv'")

    entries = filter_entries(
        db=db,
        source_type=source_type,
        from_date=from_date,
        to_date=to_date,
    )

    if format == "json":
        content = export_as_json(entries)
        media_type = "application/json"
        filename = "audit-trail.json"
    else:
        content = export_as_csv(entries)
        media_type = "text/csv"
        filename = "audit-trail.csv"

    output = io.BytesIO(content.encode())
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@app.get("/api/audit-logs/{response_id}", response_model=AuditLogResponse)
def get_audit_log(
    response_id: str,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_audit_access),
):
    entry = db.query(AuditLogEntry).filter(AuditLogEntry.response_id == response_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@app.get("/api/audit-logs/{response_id}/reviews", response_model=list[AuditLogResponse])
def get_entry_reviews(
    response_id: str,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_audit_access),
):
    return get_reviews_for_entry(response_id, db)


@app.post("/api/audit-logs/{response_id}/review", response_model=AuditLogResponse)
def submit_review(
    response_id: str,
    request: ReviewRequest,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_audit_access),
):
    if request.status not in ["approved", "flagged"]:
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'flagged'")

    try:
        review_entry = create_review(
            response_id=response_id,
            status=request.status,
            comment=request.comment,
            reviewer=current_user,
            db=db,
        )
        return review_entry
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/detector/event", response_model=AuditLogResponse)
def log_detector_event(
    request: DetectorEventRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    user = resolve_user_from_authorization(authorization, db)
    if user:
        user_id = user.id
        user_display_name = user.display_name
    elif request.user_id and request.user_display_name:
        user_id = request.user_id
        user_display_name = request.user_display_name
    else:
        user_id = "unknown"
        user_display_name = "Unidentified (extension not signed in)"

    tab_title = (request.tab_title or "").strip() or "(untitled tab)"
    user_note = (request.user_note or "").strip()
    note_prefix = f"User note: {user_note} — " if user_note else ""
    input_text = (
        f"{note_prefix}Opened {request.matched_ai_system} at {request.domain} — "
        f"Tab: \"{tab_title}\""
    )
    reasoning_summary = (
        f"Browser visit detected to {request.matched_ai_system} ({request.domain}). "
        f"Tab: \"{tab_title}\". "
        "Enterprise governance scan — only site presence is recorded; "
        "prompts, responses, and page content are never captured."
    )
    output_text = (
        "External site presence monitored; prompts and responses "
        "remain private and out of capture scope per security policy."
    )

    entry = create_audit_log_entry(
        source_type="shadow_detector",
        user_id=user_id,
        user_display_name=user_display_name,
        ai_system=request.matched_ai_system,
        model_version="External SaaS — model version not visible to org",
        input_text=input_text,
        input_source="browser_extension",
        policy_invoked="Shadow AI Usage Policy v0.1",
        reasoning_summary=reasoning_summary,
        output_text=output_text,
        downstream_action=f"Shadow AI visit logged — {tab_title}",
        db=db,
    )

    return entry

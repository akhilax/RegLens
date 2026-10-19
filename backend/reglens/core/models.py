"""ORM models. JSON columns hold the full decision trace."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from reglens.core.db import Base


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    type: Mapped[str] = mapped_column(String(16))  # individual | company | npo
    risk: Mapped[str] = mapped_column(String(8))  # low | medium | high
    is_pep: Mapped[bool] = mapped_column(Boolean, default=False)
    has_pan: Mapped[bool] = mapped_column(Boolean, default=True)
    pan: Mapped[str | None] = mapped_column(String(10), nullable=True)
    kyc_last_updated: Mapped[date] = mapped_column(Date)
    country: Mapped[str] = mapped_column(String(2), default="IN")

    accounts: Mapped[list[Account]] = relationship(back_populates="customer")


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), index=True)
    account_number: Mapped[str] = mapped_column(String(20))
    type: Mapped[str] = mapped_column(String(16))  # savings | current
    opened_on: Mapped[date] = mapped_column(Date)

    customer: Mapped[Customer] = relationship(back_populates="accounts")
    transactions: Mapped[list[Transaction]] = relationship(back_populates="account")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(24), primary_key=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, index=True)
    amount_inr: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    channel: Mapped[str] = mapped_column(String(8))  # cash NEFT RTGS IMPS UPI SWIFT card
    direction: Mapped[str] = mapped_column(String(8))  # credit | debit
    counterparty_id: Mapped[str | None] = mapped_column(String(24), nullable=True)
    counterparty_country: Mapped[str] = mapped_column(String(2), default="IN")
    purpose_code: Mapped[str | None] = mapped_column(String(8), nullable=True)
    source: Mapped[str] = mapped_column(String(16), default="synthetic")

    account: Mapped[Account] = relationship(back_populates="transactions")


class AnalysisRun(Base):
    __tablename__ = "analysis_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    status: Mapped[str] = mapped_column(String(16), default="queued")  # queued running done failed
    source: Mapped[str] = mapped_column(String(32), default="synthetic")
    total: Mapped[int] = mapped_column(Integer, default=0)
    processed: Mapped[int] = mapped_column(Integer, default=0)
    flagged: Mapped[int] = mapped_column(Integer, default=0)
    provider: Mapped[str] = mapped_column(String(32), default="mock")
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class Decision(Base):
    __tablename__ = "decisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transaction_id: Mapped[str] = mapped_column(ForeignKey("transactions.id"), index=True)
    run_id: Mapped[int | None] = mapped_column(ForeignKey("analysis_runs.id"), nullable=True)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    # auto_cleared | pending_review | in_review | awaiting_second_approval | approved | rejected | needs_re_review
    status: Mapped[str] = mapped_column(String(32), index=True)
    risk_level: Mapped[str] = mapped_column(String(8))
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    confidence: Mapped[float] = mapped_column(Float)
    summary: Mapped[str] = mapped_column(Text)
    requires_review: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_four_eyes: Mapped[bool] = mapped_column(Boolean, default=False)
    citation_issue: Mapped[bool] = mapped_column(Boolean, default=False)
    fallback_used: Mapped[bool] = mapped_column(Boolean, default=False)
    routing_reasons: Mapped[list[str]] = mapped_column(JSON, default=list)
    features: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    rules_fired: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    retrieved: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    retrieval_query: Mapped[str] = mapped_column(Text, default="")
    llm_raw: Mapped[str] = mapped_column(Text, default="")
    output: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    invalid_citations: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    obligations: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    model_name: Mapped[str] = mapped_column(String(64))
    prompt_version: Mapped[str] = mapped_column(String(32))
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    re_review_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    transaction: Mapped[Transaction] = relationship()
    reviews: Mapped[list[ReviewAction]] = relationship(back_populates="decision", order_by="ReviewAction.id")


class ReviewAction(Base):
    __tablename__ = "review_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    decision_id: Mapped[int] = mapped_column(ForeignKey("decisions.id"), index=True)
    reviewer: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(16))  # start_review approve reject modify
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    modifications: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    decision: Mapped[Decision] = relationship(back_populates="reviews")


class AuditEntry(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    event_type: Mapped[str] = mapped_column(String(48), index=True)
    entity_type: Mapped[str] = mapped_column(String(32))
    entity_id: Mapped[str] = mapped_column(String(64))
    actor: Mapped[str] = mapped_column(String(64))
    payload: Mapped[str] = mapped_column(Text)  # canonical JSON string (hashed verbatim)
    prev_hash: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64), unique=True)


class RegDocument(Base):
    __tablename__ = "reg_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reg_id: Mapped[str] = mapped_column(String(48), index=True)
    title: Mapped[str] = mapped_column(String(255))
    issuer: Mapped[str] = mapped_column(String(128))
    version: Mapped[int] = mapped_column(Integer)
    effective_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active | superseded
    raw_text: Mapped[str] = mapped_column(Text)
    content_hash: Mapped[str] = mapped_column(String(64))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    uploaded_by: Mapped[str] = mapped_column(String(64), default="system")

    chunks: Mapped[list[RegChunk]] = relationship(back_populates="document", order_by="RegChunk.ordinal")


class RegChunk(Base):
    __tablename__ = "reg_chunks"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)  # e.g. PML-RULES-2005@v1#rule3-1-a
    document_id: Mapped[int] = mapped_column(ForeignKey("reg_documents.id"), index=True)
    reg_id: Mapped[str] = mapped_column(String(48), index=True)
    version: Mapped[int] = mapped_column(Integer)
    section: Mapped[str] = mapped_column(String(64))
    heading: Mapped[str] = mapped_column(String(255))
    text: Mapped[str] = mapped_column(Text)
    content_hash: Mapped[str] = mapped_column(String(64))
    ordinal: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(16), default="active")

    document: Mapped[RegDocument] = relationship(back_populates="chunks")

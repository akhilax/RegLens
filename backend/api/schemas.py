"""API response/request models (also the source of the generated TypeScript types)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class TransactionOut(BaseModel):
    id: str
    account_id: str
    account_masked: str
    customer_id: str
    customer_name: str
    customer_type: str
    customer_risk: str
    is_pep: bool
    has_pan: bool
    timestamp: datetime
    amount_inr: float
    currency: str
    channel: str
    direction: str
    counterparty_id: str | None
    counterparty_country: str
    purpose_code: str | None
    source: str
    decision_id: int | None = None
    decision_status: str | None = None
    risk_level: str | None = None
    rules: list[str] = Field(default_factory=list)


class Obligation(BaseModel):
    type: str
    reporting: bool = False
    deadline: str | None = None
    deadline_basis: str | None = None
    description: str
    source_rule_id: str
    determined_on: str | None = None


class ReviewOut(BaseModel):
    id: int
    reviewer: str
    action: str
    comment: str | None
    modifications: dict[str, Any] | None
    created_at: datetime


class DecisionSummary(BaseModel):
    id: int
    transaction_id: str
    status: str
    risk_level: str
    risk_score: float
    confidence: float
    summary: str
    requires_review: bool
    requires_four_eyes: bool
    citation_issue: bool
    fallback_used: bool
    routing_reasons: list[str]
    rules: list[str]
    obligations: list[Obligation]
    earliest_deadline: str | None
    approvals: list[str]
    re_review_reason: str | None
    amount_inr: float
    channel: str
    direction: str
    timestamp: datetime
    customer_type: str
    customer_name: str
    counterparty_country: str
    created_at: datetime


class RetrievedChunkOut(BaseModel):
    chunk_id: str
    reg_id: str
    version: int
    section: str
    heading: str
    text: str
    content_hash: str
    score: float
    bm25_rank: int | None
    vector_rank: int | None
    method: str


class RuleHitOut(BaseModel):
    rule_id: str
    name: str
    description: str
    severity: str
    obligation: dict[str, Any]
    deadline_rule: str
    deadline: str | None
    deadline_basis: str
    source_refs: list[str]
    evidence: list[dict[str, Any]]


class AuditEntryOut(BaseModel):
    id: int
    timestamp: datetime
    event_type: str
    entity_type: str
    entity_id: str
    actor: str
    payload: str
    prev_hash: str
    hash: str


class DecisionDetail(DecisionSummary):
    features: dict[str, Any]
    rules_fired: list[RuleHitOut]
    retrieved: list[RetrievedChunkOut]
    retrieval_query: str
    output: dict[str, Any]
    invalid_citations: list[dict[str, Any]]
    model_name: str
    prompt_version: str
    latency_ms: float
    llm_raw: str
    reviews: list[ReviewOut]
    transaction: TransactionOut
    audit: list[AuditEntryOut]


class ReviewIn(BaseModel):
    reviewer: str
    action: Literal["start_review", "approve", "reject", "modify"]
    comment: str | None = None
    modifications: dict[str, Any] | None = None


class DeadlineItem(BaseModel):
    decision_id: int
    transaction_id: str
    type: str
    deadline: str
    risk_level: str
    status: str


class DailyPoint(BaseModel):
    date: date
    transactions: int
    flagged: int
    volume_inr: float


class Stats(BaseModel):
    transactions: int
    analyzed: int
    flagged: int
    auto_cleared: int
    logged: int
    pending_review: int
    in_review: int
    awaiting_second_approval: int
    approved: int
    rejected: int
    needs_re_review: int
    citation_issues: int
    hallucinations_blocked: int
    volume_inr: float
    flagged_volume_inr: float
    risk_distribution: dict[str, int]
    by_rule: dict[str, int]
    by_obligation: dict[str, int]
    by_channel: dict[str, int]
    daily: list[DailyPoint]
    upcoming_deadlines: list[DeadlineItem]
    audit_entries: int
    last_run: dict[str, Any] | None


class RunOut(BaseModel):
    id: int
    status: str
    source: str
    total: int
    processed: int
    flagged: int
    provider: str
    started_at: datetime
    finished_at: datetime | None
    error: str | None


class RunStartIn(BaseModel):
    pace_ms: int | None = Field(default=None, ge=0, le=200)


class UploadResult(BaseModel):
    run_id: int | None
    inserted: int
    errors: list[str]


class ChunkOut(BaseModel):
    id: str
    section: str
    heading: str
    text: str
    content_hash: str
    version: int
    status: str


class VersionOut(BaseModel):
    id: int
    version: int
    status: str
    effective_date: date | None
    uploaded_at: datetime
    uploaded_by: str
    content_hash: str


class DocumentOut(BaseModel):
    id: int
    reg_id: str
    title: str
    issuer: str
    version: int
    effective_date: date | None
    source_url: str | None
    status: str
    uploaded_at: datetime
    uploaded_by: str
    content_hash: str
    chunk_count: int
    citing_decisions: int
    versions: list[VersionOut]


class DocumentDetail(DocumentOut):
    banner: str
    chunks: list[ChunkOut]


class SectionDiffOut(BaseModel):
    section: str
    heading: str
    change: str
    old_chunk_id: str | None
    new_chunk_id: str | None
    old_text: str | None
    new_text: str | None
    old_hash: str | None
    new_hash: str | None


class ImpactItem(BaseModel):
    decision_id: int
    transaction_id: str
    previous_status: str
    risk_level: str
    sections: list[str]
    cited_chunk_ids: list[str]


class IngestOut(BaseModel):
    document_id: int
    reg_id: str
    version: int
    status: str
    previous_version: int | None
    diff: list[SectionDiffOut]
    impacted: list[ImpactItem]
    informational: int


class TextUploadIn(BaseModel):
    text: str
    uploaded_by: str = "meera"


class BlockStatusOut(BaseModel):
    id: int
    hash: str
    valid: bool
    reason: str | None


class ChainReportOut(BaseModel):
    valid: bool
    checked: int
    broken_at: int | None
    blocks: list[BlockStatusOut]
    simulated: bool = False


class TamperIn(BaseModel):
    entry_id: int


class ReviewerOut(BaseModel):
    id: str
    name: str
    role: str


class RuleOut(BaseModel):
    id: str
    name: str
    description: str
    severity: str
    obligation: dict[str, Any]
    deadline_rule: str
    source_refs: list[str]


class MetaOut(BaseModel):
    app: str
    version: str
    llm_provider: str
    llm_model: str
    prompt_versions: dict[str, str]
    retriever: str
    reviewers: list[ReviewerOut]
    rules: list[RuleOut]
    params: dict[str, Any]
    high_risk_jurisdictions: list[str]


class SearchHit(BaseModel):
    kind: Literal["transaction", "decision", "regulation"]
    id: str
    title: str
    subtitle: str
    href: str


class ReportTypeOut(BaseModel):
    type: str
    title: str
    approved_count: int

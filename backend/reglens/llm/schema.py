"""Strict schema for the LLM's analysis output."""

from __future__ import annotations

import json
import re
from typing import Literal

from pydantic import BaseModel, Field, ValidationError


class ApplicableRegulation(BaseModel):
    reg_id: str
    section: str
    reason: str
    citation_chunk_ids: list[str] = Field(default_factory=list)


class ObligationOut(BaseModel):
    type: str
    deadline: str | None = None
    description: str
    source_rule_id: str


class LLMAnalysis(BaseModel):
    applicable_regulations: list[ApplicableRegulation] = Field(default_factory=list)
    obligations: list[ObligationOut] = Field(default_factory=list)
    risk_level: Literal["low", "medium", "high"]
    confidence: float = Field(ge=0.0, le=1.0)
    summary: str


_JSON_BLOCK = re.compile(r"\{.*\}", re.DOTALL)


def parse_analysis(raw: str) -> LLMAnalysis:
    """Extract the outermost JSON object (tolerates ```json fences) and validate it."""
    match = _JSON_BLOCK.search(raw or "")
    if not match:
        raise ValueError("No JSON object found in model output")
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON: {exc}") from exc
    try:
        return LLMAnalysis.model_validate(data)
    except ValidationError as exc:
        raise ValueError(f"Schema validation failed: {exc.errors()[:3]}") from exc

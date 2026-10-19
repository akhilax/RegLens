"""LLM provider abstraction: Mock (offline, deterministic), Claude (Anthropic SDK), Ollama (local HTTP)."""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any, Protocol

from reglens.config import get_settings

SEVERITY_TO_RISK = {"low": "low", "medium": "medium", "high": "high", "critical": "high"}


@dataclass
class LLMRequest:
    system: str
    user: str
    # Structured mirror of the prompt; only the mock provider reads it (real models read the prompt text).
    context: dict[str, Any] = field(default_factory=dict)
    attempt: int = 1
    previous_error: str | None = None


class LLMProvider(Protocol):
    name: str
    model: str

    def complete(self, req: LLMRequest) -> str: ...

    def stream(self, req: LLMRequest) -> Iterator[str]: ...


def _stable_int(text: str) -> int:
    return int(hashlib.sha256(text.encode()).hexdigest()[:8], 16)


class MockLLMProvider:
    """Deterministic stand-in that behaves like a careful (but imperfect) model.

    * Builds the analysis from the rules fired and the clauses actually retrieved.
    * Deliberately hallucinates a citation on some flagged transactions so the guardrail can be demoed.
    * Returns malformed JSON on the first attempt for a few transactions to exercise the retry path.
    """

    name = "mock"
    model = "mock-reglens-1"

    def complete(self, req: LLMRequest) -> str:
        ctx = req.context
        if ctx.get("task") == "qa":
            return "".join(self.stream(req))
        txn_id: str = ctx.get("txn_id", "")
        h = _stable_int(txn_id)
        if req.attempt == 1 and h % 40 == 3:
            return '{"applicable_regulations": [{"reg_id": "PML-RULES-2005", "section": '  # truncated on purpose

        rules: list[dict[str, Any]] = ctx.get("rules", [])
        chunks: list[dict[str, Any]] = ctx.get("chunks", [])
        by_ref = {f"{c['reg_id']}#{c['section']}": c["chunk_id"] for c in chunks}

        regs: dict[str, dict[str, Any]] = {}
        for r in rules:
            for ref in r["source_refs"]:
                cid = by_ref.get(ref)
                if cid is None:
                    continue
                reg_id, _, section = ref.partition("#")
                entry = regs.setdefault(reg_id, {"reg_id": reg_id, "section": section, "reason": "",
                                                 "citation_chunk_ids": []})
                if cid not in entry["citation_chunk_ids"]:
                    entry["citation_chunk_ids"].append(cid)
                reason = f"{r['name']}: {r['description']}"
                if reason not in entry["reason"]:
                    entry["reason"] = (entry["reason"] + " " + reason).strip()

        rule_ids = {r["rule_id"] for r in rules}
        if regs and ("R-STRUCT" in rule_ids or h % 6 == 0):
            first = next(iter(regs.values()))
            first["citation_chunk_ids"].append(f"{first['reg_id']}@v1#sec-{h % 97}-hallucinated")

        obligations = [
            {"type": r["obligation"]["type"], "deadline": r["deadline"], "description": r["obligation"]["description"],
             "source_rule_id": r["rule_id"]}
            for r in rules
        ]
        severities = [r["severity"] for r in rules]
        order = ["low", "medium", "high", "critical"]
        risk = SEVERITY_TO_RISK[max(severities, key=order.index)] if severities else "low"
        if not rules:
            confidence = 0.95
        elif len(rules) >= 3:
            confidence = 0.55
        elif "R-STRUCT" in rule_ids:
            confidence = 0.68
        elif "R-HRJ" in rule_ids:
            confidence = 0.74
        else:
            confidence = 0.9 - 0.02 * (h % 5)

        if rules:
            names = ", ".join(r["name"] for r in rules)
            summary = (f"{len(rules)} rule(s) triggered ({names}). Applicable provisions identified from "
                       f"{len(regs)} regulation(s); obligations and deadlines are taken from the deterministic rules.")
        else:
            summary = "No rule thresholds were met and no retrieved provision indicates a reporting obligation."
        out = {"applicable_regulations": list(regs.values()), "obligations": obligations, "risk_level": risk,
               "confidence": round(confidence, 2), "summary": summary}
        return json.dumps(out)

    def stream(self, req: LLMRequest) -> Iterator[str]:
        chunks: list[dict[str, Any]] = req.context.get("chunks", [])
        question: str = req.context.get("question", "")
        if not chunks:
            yield "I could not find a provision in the knowledge base that answers this question."
            return
        parts = [f"Here is what the knowledge base says about “{question.strip().rstrip('?')}”:\n\n"]
        for c in chunks[:4]:
            sentences = re.split(r"(?<=[.;])\s+", c["text"].strip())
            excerpt = " ".join(sentences[:2])
            parts.append(f"• **{c['heading']}** — {excerpt} [{c['chunk_id']}]\n\n")
        parts.append("_Educational summary — verify against the official source before acting._")
        yield from re.findall(r"\S+\s*", "".join(parts))


class ClaudeProvider:
    name = "claude"

    def __init__(self) -> None:
        import anthropic

        s = get_settings()
        if not s.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        self.client = anthropic.Anthropic(api_key=s.anthropic_api_key)
        self.model = s.llm_model

    def _messages(self, req: LLMRequest) -> list[dict[str, str]]:
        msgs = [{"role": "user", "content": req.user}]
        if req.previous_error:
            from reglens.llm.prompts import REPAIR_USER

            msgs.append({"role": "assistant", "content": "(invalid output omitted)"})
            msgs.append({"role": "user", "content": REPAIR_USER.format(error=req.previous_error)})
        return msgs

    def complete(self, req: LLMRequest) -> str:
        resp = self.client.messages.create(model=self.model, max_tokens=2000, system=req.system,
                                           messages=self._messages(req))
        return "".join(getattr(b, "text", "") for b in resp.content)

    def stream(self, req: LLMRequest) -> Iterator[str]:
        with self.client.messages.stream(model=self.model, max_tokens=1200, system=req.system,
                                         messages=self._messages(req)) as stream:
            yield from stream.text_stream


class OllamaProvider:
    name = "ollama"

    def __init__(self) -> None:
        s = get_settings()
        self.url = s.ollama_url.rstrip("/")
        self.model = s.ollama_model

    def _payload(self, req: LLMRequest, stream: bool, json_mode: bool) -> dict[str, Any]:
        user = req.user
        if req.previous_error:
            from reglens.llm.prompts import REPAIR_USER

            user += "\n\n" + REPAIR_USER.format(error=req.previous_error)
        body: dict[str, Any] = {"model": self.model, "stream": stream,
                                "messages": [{"role": "system", "content": req.system},
                                             {"role": "user", "content": user}]}
        if json_mode:
            body["format"] = "json"
        return body

    def complete(self, req: LLMRequest) -> str:
        import httpx

        r = httpx.post(f"{self.url}/api/chat", json=self._payload(req, False, True), timeout=120)
        r.raise_for_status()
        return r.json()["message"]["content"]

    def stream(self, req: LLMRequest) -> Iterator[str]:
        import httpx

        with httpx.stream("POST", f"{self.url}/api/chat", json=self._payload(req, True, False), timeout=120) as r:
            for line in r.iter_lines():
                if line:
                    yield json.loads(line).get("message", {}).get("content", "")


@lru_cache
def get_provider(name: str | None = None) -> LLMProvider:
    choice = (name or get_settings().llm_provider).lower()
    if choice == "claude":
        return ClaudeProvider()
    if choice == "ollama":
        return OllamaProvider()
    return MockLLMProvider()

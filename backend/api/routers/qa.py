"""'Ask the Regulations' — streamed RAG Q&A with validated citations."""

from __future__ import annotations

import asyncio
import re

from fastapi import APIRouter, Query, Request

from api.sse import sse, sse_response
from reglens.core.db import new_session
from reglens.kb.retriever import get_retriever
from reglens.llm import prompts
from reglens.llm.providers import LLMRequest, get_provider

router = APIRouter(prefix="/qa", tags=["qa"])
CITE = re.compile(r"\[([A-Z0-9\-]+@v\d+#[a-z0-9\-]+)\]")
SUGGESTIONS = [
    "When must a Cash Transaction Report be filed?",
    "What counts as structuring?",
    "How often must KYC be updated for a high-risk customer?",
    "What is the LRS limit per financial year?",
    "Which cross-border wires must be reported?",
    "What due diligence applies to PEPs?",
]


@router.get("/suggestions", response_model=list[str])
def suggestions() -> list[str]:
    return SUGGESTIONS


@router.get("/stream")
async def ask(request: Request, q: str = Query(min_length=3, max_length=500)):
    session = new_session()
    try:
        chunks = [c.to_dict() for c in get_retriever(session).search(q, top_k=5)]
    finally:
        session.close()
    provider = get_provider()
    is_mock = provider.name == "mock"
    req = LLMRequest(system=prompts.QA_SYSTEM, user=prompts.qa_user(q, chunks),
                     context={"task": "qa", "question": q, "chunks": chunks})

    async def gen():
        yield sse({"type": "retrieved", "chunks": chunks, "model": f"{provider.name}:{provider.model}",
                   "prompt_version": prompts.QA_VERSION})
        text = ""
        iterator = provider.stream(req)
        while True:
            if await request.is_disconnected():
                return
            token = await asyncio.to_thread(next, iterator, None)
            if token is None:
                break
            text += token
            yield sse({"type": "token", "text": token})
            if is_mock:
                await asyncio.sleep(0.018)
        retrieved = {c["chunk_id"] for c in chunks}
        cited = list(dict.fromkeys(CITE.findall(text)))
        yield sse({"type": "done", "citations": [c for c in cited if c in retrieved],
                   "invalid_citations": [c for c in cited if c not in retrieved]})

    return sse_response(gen())

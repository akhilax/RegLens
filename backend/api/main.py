"""RegLens FastAPI application."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import analysis, dashboard, decisions, reports, transactions
from reglens import __version__
from reglens.config import get_settings
from reglens.core.db import init_db, session_scope
from reglens.kb.retriever import get_retriever

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    with session_scope() as s:
        get_retriever(s, refresh=True)
    yield


app = FastAPI(
    title="RegLens API",
    version=__version__,
    description="Traceable RAG-powered transaction compliance assistant. Educational prototype — not legal advice.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(get_settings().cors_origins),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


for module in (dashboard, transactions, analysis, decisions, reports):
    app.include_router(module.router, prefix="/api")

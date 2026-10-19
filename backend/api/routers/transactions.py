"""Transactions: paginated, filterable listing."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api import schemas
from api.convert import txn_out
from reglens.core.db import get_db
from reglens.core.models import Account, Customer, Decision, Transaction

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=schemas.Page[schemas.TransactionOut])
def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),
    channel: str | None = None,
    direction: Literal["credit", "debit"] | None = None,
    risk: Literal["low", "medium", "high"] | None = None,
    flagged: bool | None = None,
    q: str | None = Query(None, max_length=64),
    min_amount: float | None = None,
    db: Session = Depends(get_db),
) -> schemas.Page[schemas.TransactionOut]:
    stmt = (
        select(Transaction, Account, Customer, Decision)
        .join(Account, Transaction.account_id == Account.id)
        .join(Customer, Account.customer_id == Customer.id)
        .outerjoin(Decision, (Decision.transaction_id == Transaction.id) & Decision.is_current)
    )
    if channel:
        stmt = stmt.where(Transaction.channel == channel)
    if direction:
        stmt = stmt.where(Transaction.direction == direction)
    if risk:
        stmt = stmt.where(Decision.risk_level == risk)
    if flagged is True:
        stmt = stmt.where(Decision.status.notin_(["auto_cleared"]))
    elif flagged is False:
        stmt = stmt.where((Decision.status == "auto_cleared") | (Decision.id.is_(None)))
    if min_amount is not None:
        stmt = stmt.where(Transaction.amount_inr >= min_amount)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(Transaction.id.ilike(like) | Transaction.account_id.ilike(like) | Customer.name.ilike(like))

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.execute(
        stmt.order_by(Transaction.timestamp.desc(), Transaction.id.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return schemas.Page(items=[txn_out(t, a, c, d) for t, a, c, d in rows], total=total, page=page,
                        page_size=page_size)


@router.get("/{txn_id}", response_model=schemas.TransactionOut)
def get_transaction(txn_id: str, db: Session = Depends(get_db)) -> schemas.TransactionOut:
    row = db.execute(
        select(Transaction, Account, Customer, Decision)
        .join(Account, Transaction.account_id == Account.id)
        .join(Customer, Account.customer_id == Customer.id)
        .outerjoin(Decision, (Decision.transaction_id == Transaction.id) & Decision.is_current)
        .where(Transaction.id == txn_id)
    ).first()
    if row is None:
        raise HTTPException(404, "Transaction not found")
    return txn_out(*row)

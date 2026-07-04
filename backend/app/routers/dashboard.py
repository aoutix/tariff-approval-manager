from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import require_role

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

# Only Approved/Pending rows are shown on the timeline: Approved rows are the
# authoritative ones for the no-overlap rule, and Pending rows are useful to
# preview as a "would this conflict once approved" signal. Draft/Rejected
# rows aren't part of the workflow race that overlaps care about.
TIMELINE_STATUSES = (models.TariffStatus.APPROVED, models.TariffStatus.PENDING)


@router.get("", response_model=schemas.DashboardOut)
def get_dashboard(
    status: Optional[models.TariffStatus] = None,
    currency: Optional[models.Currency] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role(models.Role.APPROVER)),
):
    query = db.query(models.Tariff)
    if status is not None:
        query = query.filter(models.Tariff.status == status)
    if currency is not None:
        query = query.filter(models.Tariff.currency == currency)
    if date_from is not None:
        query = query.filter(models.Tariff.valid_until >= date_from)
    if date_to is not None:
        query = query.filter(models.Tariff.valid_from <= date_to)
    tariffs = query.all()

    counts_by_status = {s.value: 0 for s in models.TariffStatus}
    breakdown_by_move_type = {m.value: 0 for m in models.MoveType}
    breakdown_by_currency = {c.value: 0 for c in models.Currency}

    for t in tariffs:
        counts_by_status[t.status.value] += 1
        breakdown_by_move_type[t.move_type.value] += 1
        breakdown_by_currency[t.currency.value] += 1

    lanes: dict[tuple, list] = {}
    for t in tariffs:
        if t.status not in TIMELINE_STATUSES:
            continue
        lanes.setdefault((t.size, t.move_type), []).append(t)

    timeline = [
        schemas.TimelineLaneOut(
            size=size,
            move_type=move_type,
            segments=[
                schemas.TimelineSegmentOut(
                    id=t.id,
                    status=t.status,
                    valid_from=t.valid_from,
                    valid_until=t.valid_until,
                    contract_name=t.contract.name,
                )
                for t in sorted(rows, key=lambda r: r.valid_from)
            ],
        )
        for (size, move_type), rows in sorted(lanes.items(), key=lambda kv: (kv[0][0].value, kv[0][1].value))
    ]

    recent_logs = (
        db.query(models.AuditLog)
        .order_by(models.AuditLog.timestamp.desc())
        .limit(20)
        .all()
    )
    recent_activity = [
        schemas.ActivityOut(
            id=a.id,
            tariff_id=a.tariff_id,
            username=a.user.username,
            action=a.action,
            detail=a.detail,
            timestamp=a.timestamp,
            size=a.tariff.size,
            move_type=a.tariff.move_type,
            contract_name=a.tariff.contract.name,
        )
        for a in recent_logs
    ]

    return schemas.DashboardOut(
        counts_by_status=counts_by_status,
        breakdown_by_move_type=breakdown_by_move_type,
        breakdown_by_currency=breakdown_by_currency,
        total_tariffs=len(tariffs),
        timeline=timeline,
        recent_activity=recent_activity,
    )

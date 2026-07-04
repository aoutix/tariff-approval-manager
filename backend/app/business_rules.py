"""
Core business rules, kept separate from the routers so they can be unit
tested directly and reused at both the "submit" and "approve" points.

Boundary rule (as decided and stated in NOTES.md):
    Two periods [a_start, a_end] and [b_start, b_end] overlap if and only if
        a_start <= b_end AND b_start <= a_end
    This means a tariff ending 30 Jun and another starting 30 Jun DO overlap
    (they share the day 30 Jun). A tariff ending 30 Jun and another starting
    1 Jul do NOT overlap.
"""
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app import models


class BusinessRuleError(Exception):
    """Raised when a business rule is violated. Carries a user-facing message."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def periods_overlap(a_start: date, a_end: date, b_start: date, b_end: date) -> bool:
    return a_start <= b_end and b_start <= a_end


def check_period_within_contract(
    contract: models.Contract, valid_from: date, valid_until: date
) -> None:
    if valid_from > valid_until:
        raise BusinessRuleError("Tariff valid_from must be on or before valid_until.")
    if valid_from < contract.valid_from or valid_until > contract.valid_until:
        raise BusinessRuleError(
            f"Tariff period ({valid_from} to {valid_until}) must fall within the "
            f"parent contract's validity period ({contract.valid_from} to {contract.valid_until})."
        )


def check_no_overlap(
    db: Session,
    contract_id: int,
    size: models.ContainerSize,
    move_type: models.MoveType,
    valid_from: date,
    valid_until: date,
    exclude_tariff_id: Optional[int] = None,
) -> None:
    """
    Only Approved rows are authoritative for the overlap check (per the
    locked-in decision: Draft/Pending/Rejected rows don't block others).
    Run this both at submit (Pending) and at approve time, since another
    row could have been approved in between.

    Wildcard "Any" move type: it stands for every move type at once, so it
    must be treated as conflicting with all of them for the same size - in
    both directions. An Approved "Any" row blocks a later "import"/"export"/
    "transshipment" row of the same size/period (it already covers that
    lane), and a specific-move-type Approved row equally blocks a later
    "Any" row (the "Any" row would re-cover an already-taken lane). Only
    when both rows are non-"Any" do we need an exact move_type match.
    """
    query = db.query(models.Tariff).filter(
        models.Tariff.contract_id == contract_id,
        models.Tariff.size == size,
        models.Tariff.status == models.TariffStatus.APPROVED,
    )
    if move_type != models.MoveType.ANY:
        query = query.filter(
            (models.Tariff.move_type == move_type) | (models.Tariff.move_type == models.MoveType.ANY)
        )
    # else: move_type is "Any", which conflicts with every existing move type
    # of this size, so no move_type filter is applied at all.
    if exclude_tariff_id is not None:
        query = query.filter(models.Tariff.id != exclude_tariff_id)

    for existing in query.all():
        if periods_overlap(valid_from, valid_until, existing.valid_from, existing.valid_until):
            raise BusinessRuleError(
                f"This tariff ({valid_from} to {valid_until}) overlaps with an already "
                f"Approved tariff #{existing.id} for the same size ({size.value}) and "
                f"move type ({move_type.value}), valid {existing.valid_from} to {existing.valid_until}."
            )

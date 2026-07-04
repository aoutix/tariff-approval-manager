from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, require_role
from app.business_rules import BusinessRuleError, check_period_within_contract, check_no_overlap

router = APIRouter(prefix="/api/tariffs", tags=["tariffs"])


def _log(db: Session, tariff_id: int, user_id: int, action: str, detail: Optional[str] = None):
    db.add(models.AuditLog(tariff_id=tariff_id, user_id=user_id, action=action, detail=detail))


def _get_tariff_or_404(db: Session, tariff_id: int) -> models.Tariff:
    tariff = db.query(models.Tariff).filter(models.Tariff.id == tariff_id).first()
    if not tariff:
        raise HTTPException(404, "Tariff not found.")
    return tariff


def _get_contract_or_404(db: Session, contract_id: int) -> models.Contract:
    contract = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(404, "Contract not found.")
    return contract


@router.get("", response_model=List[schemas.TariffOut])
def list_tariffs(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    query = db.query(models.Tariff)
    if user.role == models.Role.VIEWER:
        query = query.filter(models.Tariff.status == models.TariffStatus.APPROVED)
    elif user.role == models.Role.APPROVER:
        pass  # Approvers can see everything (need Pending visibility, dashboard needs all)
    return query.all()


@router.post("", response_model=schemas.TariffOut, status_code=201)
def create_tariff(
    payload: schemas.TariffCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role(models.Role.CREATOR)),
):
    contract = _get_contract_or_404(db, payload.contract_id)
    try:
        check_period_within_contract(contract, payload.valid_from, payload.valid_until)
    except BusinessRuleError as e:
        raise HTTPException(400, e.message)

    tariff = models.Tariff(**payload.model_dump(), status=models.TariffStatus.DRAFT, created_by_id=user.id)
    db.add(tariff)
    db.flush()
    _log(db, tariff.id, user.id, "created", "Draft created")
    db.commit()
    db.refresh(tariff)
    return tariff


@router.put("/{tariff_id}", response_model=schemas.TariffOut)
def update_tariff(
    tariff_id: int,
    payload: schemas.TariffUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role(models.Role.CREATOR)),
):
    tariff = _get_tariff_or_404(db, tariff_id)

    if tariff.created_by_id != user.id:
        raise HTTPException(403, "You can only edit tariffs you created.")

    if tariff.status not in (models.TariffStatus.DRAFT, models.TariffStatus.REJECTED):
        raise HTTPException(
            400, f"Cannot edit a tariff with status '{tariff.status.value}'. Only Draft or Rejected rows can be edited."
        )

    was_rejected = tariff.status == models.TariffStatus.REJECTED

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tariff, field, value)

    contract = _get_contract_or_404(db, tariff.contract_id)
    try:
        check_period_within_contract(contract, tariff.valid_from, tariff.valid_until)
    except BusinessRuleError as e:
        db.rollback()
        raise HTTPException(400, e.message)

    if was_rejected:
        # Editing a Rejected row resubmits it for approval.
        tariff.status = models.TariffStatus.PENDING
        tariff.rejection_reason = None
        try:
            check_no_overlap(db, tariff.contract_id, tariff.size, tariff.move_type, tariff.valid_from, tariff.valid_until, exclude_tariff_id=tariff.id)
        except BusinessRuleError as e:
            db.rollback()
            raise HTTPException(400, e.message)
        _log(db, tariff.id, user.id, "edited_and_resubmitted")

    db.commit()
    db.refresh(tariff)
    return tariff


@router.post("/{tariff_id}/submit", response_model=schemas.TariffOut)
def submit_tariff(
    tariff_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role(models.Role.CREATOR)),
):
    tariff = _get_tariff_or_404(db, tariff_id)
    if tariff.created_by_id != user.id:
        raise HTTPException(403, "You can only submit tariffs you created.")
    if tariff.status != models.TariffStatus.DRAFT:
        raise HTTPException(400, f"Only Draft tariffs can be submitted (current status: {tariff.status.value}).")

    try:
        check_no_overlap(
            db, tariff.contract_id, tariff.size, tariff.move_type,
            tariff.valid_from, tariff.valid_until, exclude_tariff_id=tariff.id,
        )
    except BusinessRuleError as e:
        raise HTTPException(400, e.message)

    tariff.status = models.TariffStatus.PENDING
    _log(db, tariff.id, user.id, "submitted")
    db.commit()
    db.refresh(tariff)
    return tariff


@router.post("/{tariff_id}/approve", response_model=schemas.TariffOut)
def approve_tariff(
    tariff_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role(models.Role.APPROVER)),
):
    tariff = _get_tariff_or_404(db, tariff_id)
    if tariff.status != models.TariffStatus.PENDING:
        raise HTTPException(400, f"Only Pending tariffs can be approved (current status: {tariff.status.value}).")

    if tariff.created_by_id == user.id:
        raise HTTPException(403, "An Approver cannot approve a tariff row they created themselves.")

    # Re-check overlap at approval time too: another row could have been
    # approved in the meantime, since submit-time checks aren't enough.
    try:
        check_no_overlap(
            db, tariff.contract_id, tariff.size, tariff.move_type,
            tariff.valid_from, tariff.valid_until, exclude_tariff_id=tariff.id,
        )
    except BusinessRuleError as e:
        raise HTTPException(400, e.message)

    tariff.status = models.TariffStatus.APPROVED
    tariff.approved_by_id = user.id
    _log(db, tariff.id, user.id, "approved")
    db.commit()
    db.refresh(tariff)
    return tariff


@router.post("/{tariff_id}/reject", response_model=schemas.TariffOut)
def reject_tariff(
    tariff_id: int,
    payload: schemas.RejectPayload,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role(models.Role.APPROVER)),
):
    tariff = _get_tariff_or_404(db, tariff_id)
    if tariff.status != models.TariffStatus.PENDING:
        raise HTTPException(400, f"Only Pending tariffs can be rejected (current status: {tariff.status.value}).")

    if tariff.created_by_id == user.id:
        raise HTTPException(403, "An Approver cannot reject/act on their own submitted tariff.")

    tariff.status = models.TariffStatus.REJECTED
    tariff.rejection_reason = payload.reason
    _log(db, tariff.id, user.id, "rejected", payload.reason)
    db.commit()
    db.refresh(tariff)
    return tariff


@router.get("/{tariff_id}/audit-log", response_model=List[schemas.AuditLogOut])
def get_audit_log(
    tariff_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role(models.Role.APPROVER, models.Role.CREATOR)),
):
    _get_tariff_or_404(db, tariff_id)
    return db.query(models.AuditLog).filter(models.AuditLog.tariff_id == tariff_id).order_by(models.AuditLog.timestamp).all()

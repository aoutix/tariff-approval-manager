from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/api/contracts", tags=["contracts"])

# Only Creators manage contracts in this assignment's scope; everyone can view.
MANAGE_ROLES = (models.Role.CREATOR,)


@router.get("", response_model=List[schemas.ContractWithTariffsOut])
def list_contracts(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    contracts = db.query(models.Contract).all()
    if user.role == models.Role.VIEWER:
        # Viewers only ever see Approved tariffs.
        for c in contracts:
            c.tariffs = [t for t in c.tariffs if t.status == models.TariffStatus.APPROVED]
    return contracts


@router.post("", response_model=schemas.ContractOut, status_code=201)
def create_contract(
    payload: schemas.ContractCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role(*MANAGE_ROLES)),
):
    if payload.valid_from > payload.valid_until:
        raise HTTPException(400, "valid_from must be on or before valid_until.")
    contract = models.Contract(**payload.model_dump())
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return contract


@router.put("/{contract_id}", response_model=schemas.ContractOut)
def update_contract(
    contract_id: int,
    payload: schemas.ContractUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role(*MANAGE_ROLES)),
):
    contract = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(404, "Contract not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(contract, field, value)
    if contract.valid_from > contract.valid_until:
        raise HTTPException(400, "valid_from must be on or before valid_until.")
    db.commit()
    db.refresh(contract)
    return contract

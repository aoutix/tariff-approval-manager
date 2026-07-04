from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, Field, ConfigDict

from app.models import Role, ContainerSize, MoveType, Currency, TariffStatus


# ---------- Users ----------

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    role: Role


# ---------- Contracts ----------

class ContractCreate(BaseModel):
    name: str
    valid_from: date
    valid_until: date


class ContractUpdate(BaseModel):
    name: Optional[str] = None
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None


class ContractOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    valid_from: date
    valid_until: date


# ---------- Tariffs ----------

class TariffCreate(BaseModel):
    contract_id: int
    size: ContainerSize
    move_type: MoveType
    currency: Currency
    price: Decimal = Field(gt=0)
    valid_from: date
    valid_until: date


class TariffUpdate(BaseModel):
    size: Optional[ContainerSize] = None
    move_type: Optional[MoveType] = None
    currency: Optional[Currency] = None
    price: Optional[Decimal] = Field(default=None, gt=0)
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None


class RejectPayload(BaseModel):
    reason: Optional[str] = None


class TariffOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    contract_id: int
    size: ContainerSize
    move_type: MoveType
    currency: Currency
    price: Decimal
    valid_from: date
    valid_until: date
    status: TariffStatus
    rejection_reason: Optional[str] = None
    created_by_id: int
    approved_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class ContractWithTariffsOut(ContractOut):
    tariffs: List[TariffOut] = []


# ---------- Audit ----------

class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tariff_id: int
    user_id: int
    action: str
    detail: Optional[str] = None
    timestamp: datetime


# ---------- Dashboard ----------

class TimelineSegmentOut(BaseModel):
    id: int
    status: TariffStatus
    valid_from: date
    valid_until: date
    contract_name: str


class TimelineLaneOut(BaseModel):
    size: ContainerSize
    move_type: MoveType
    segments: List[TimelineSegmentOut]


class ActivityOut(BaseModel):
    id: int
    tariff_id: int
    username: str
    action: str
    detail: Optional[str] = None
    timestamp: datetime
    size: ContainerSize
    move_type: MoveType
    contract_name: str


class DashboardOut(BaseModel):
    counts_by_status: dict
    breakdown_by_move_type: dict
    breakdown_by_currency: dict
    total_tariffs: int
    timeline: List[TimelineLaneOut] = []
    recent_activity: List[ActivityOut] = []

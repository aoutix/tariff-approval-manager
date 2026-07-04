import enum
from datetime import datetime, date

from sqlalchemy import (
    Column, Integer, String, Date, Numeric, Enum, ForeignKey, DateTime, Text
)
from sqlalchemy.orm import relationship

from app.database import Base


class Role(str, enum.Enum):
    CREATOR = "Tariff Creator"
    APPROVER = "Approver"
    VIEWER = "Viewer"


class ContainerSize(str, enum.Enum):
    FT20 = "20ft"
    FT40 = "40ft"
    FT45 = "45ft"


class MoveType(str, enum.Enum):
    IMPORT = "import"
    EXPORT = "export"
    TRANSSHIPMENT = "transshipment"
    ANY = "Any"


class Currency(str, enum.Enum):
    EUR = "EUR"
    USD = "USD"


class TariffStatus(str, enum.Enum):
    DRAFT = "Draft"
    PENDING = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    role = Column(Enum(Role), nullable=False)

    tariffs_created = relationship(
        "Tariff", back_populates="creator", foreign_keys="Tariff.created_by_id"
    )


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    valid_from = Column(Date, nullable=False)
    valid_until = Column(Date, nullable=False)

    tariffs = relationship("Tariff", back_populates="contract", cascade="all, delete-orphan")


class Tariff(Base):
    __tablename__ = "tariffs"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)

    size = Column(Enum(ContainerSize), nullable=False)
    move_type = Column(Enum(MoveType), nullable=False)
    currency = Column(Enum(Currency), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)

    valid_from = Column(Date, nullable=False)
    valid_until = Column(Date, nullable=False)

    status = Column(Enum(TariffStatus), nullable=False, default=TariffStatus.DRAFT)
    rejection_reason = Column(Text, nullable=True)

    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    contract = relationship("Contract", back_populates="tariffs")
    creator = relationship("User", foreign_keys=[created_by_id], back_populates="tariffs_created")
    approver = relationship("User", foreign_keys=[approved_by_id])
    audit_logs = relationship("AuditLog", back_populates="tariff", cascade="all, delete-orphan")


class AuditLog(Base):
    """Bonus: tracks who changed a tariff's status, and when."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    tariff_id = Column(Integer, ForeignKey("tariffs.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String, nullable=False)  # e.g. "created", "submitted", "approved", "rejected", "edited"
    detail = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    tariff = relationship("Tariff", back_populates="audit_logs")
    user = relationship("User")

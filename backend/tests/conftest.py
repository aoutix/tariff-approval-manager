import sys
import os
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.main import app
from app import models


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def seeded_users(db_session):
    creator = models.User(username="creator1", role=models.Role.CREATOR)
    creator2 = models.User(username="creator2", role=models.Role.CREATOR)
    approver = models.User(username="approver1", role=models.Role.APPROVER)
    viewer = models.User(username="viewer1", role=models.Role.VIEWER)
    db_session.add_all([creator, creator2, approver, viewer])
    db_session.commit()
    for u in (creator, creator2, approver, viewer):
        db_session.refresh(u)
    return {"creator": creator, "creator2": creator2, "approver": approver, "viewer": viewer}


@pytest.fixture()
def contract(db_session):
    c = models.Contract(name="Test Shipping Line", valid_from=date(2026, 1, 1), valid_until=date(2026, 12, 31))
    db_session.add(c)
    db_session.commit()
    db_session.refresh(c)
    return c


def headers(user):
    return {"X-User-Id": str(user.id)}

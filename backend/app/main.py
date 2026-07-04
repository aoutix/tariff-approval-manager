from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine, SessionLocal
from app import models
from app.routers import contracts, tariffs, dashboard, auth_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Tariff Approval Manager API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(contracts.router)
app.include_router(tariffs.router)
app.include_router(dashboard.router)


def seed_users():
    db = SessionLocal()
    try:
        if db.query(models.User).count() == 0:
            db.add_all([
                models.User(username="alice.creator", role=models.Role.CREATOR),
                models.User(username="carlos.creator", role=models.Role.CREATOR),
                models.User(username="bob.approver", role=models.Role.APPROVER),
                models.User(username="dana.approver", role=models.Role.APPROVER),
                models.User(username="vera.viewer", role=models.Role.VIEWER),
            ])
            db.commit()
    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    seed_users()


@app.get("/")
def root():
    return {"status": "ok", "service": "Tariff Approval Manager API"}

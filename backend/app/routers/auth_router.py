from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(prefix="/api", tags=["auth"])


@router.get("/users", response_model=List[schemas.UserOut])
def list_users(db: Session = Depends(get_db)):
    """Used by the frontend role-switcher to list seeded users to 'log in' as."""
    return db.query(models.User).all()


@router.get("/me", response_model=schemas.UserOut)
def whoami(user: models.User = Depends(get_current_user)):
    return user

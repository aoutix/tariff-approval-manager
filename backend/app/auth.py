"""
Simple auth for this assignment: the frontend sends an `X-User-Id` header
identifying which seeded user is "logged in" (via a role switcher UI).

IMPORTANT: the header only carries an identity claim (a user id). The
actual ROLE is never trusted from the client - it is always looked up
fresh from the `users` table on every request. This is what makes the
permission checks server-enforced rather than merely UI-hidden: a client
could send any role name it wanted in a header or the request body, and
it would be ignored, because we only ever read `user.role` from the DB
row we fetch using the id.
"""
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models


def get_current_user(
    x_user_id: int = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db),
) -> models.User:
    user = db.query(models.User).filter(models.User.id == x_user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Unknown or missing user (X-User-Id header)")
    return user


def require_role(*allowed_roles: models.Role):
    """Dependency factory: raises 403 if the resolved user's DB role isn't allowed."""

    def dependency(user: models.User = Depends(get_current_user)) -> models.User:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{user.role.value}' is not permitted to perform this action.",
            )
        return user

    return dependency

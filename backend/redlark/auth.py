"""Password hashing and cookie sessions for the hosted (server mode) app."""

from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .db.models import ROLES, Membership, User, UserSession

SESSION_COOKIE = "redlark_session"
_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def create_user(db: Session, email: str, password: str, name: str = "", is_admin: bool = False) -> User:
    email = email.strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise ValueError(f"A user with email {email} already exists")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    user = User(email=email, name=name or email.split("@")[0], password_hash=hash_password(password), is_admin=is_admin)
    db.add(user)
    db.flush()
    return user


def authenticate(db: Session, email: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.email == email.strip().lower()))
    if user and verify_password(user.password_hash, password):
        return user
    return None


def start_session(db: Session, user: User, days: int) -> UserSession:
    now = datetime.now(UTC)
    db.execute(delete(UserSession).where(UserSession.expires_at < now))
    sess = UserSession(token=secrets.token_urlsafe(32), user_id=user.id, expires_at=now + timedelta(days=days))
    db.add(sess)
    db.commit()
    return sess


def user_for_token(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    sess = db.get(UserSession, token)
    if sess is None:
        return None
    expires = sess.expires_at if sess.expires_at.tzinfo else sess.expires_at.replace(tzinfo=UTC)
    if expires < datetime.now(UTC):
        return None
    return db.get(User, sess.user_id)


def end_session(db: Session, token: str | None) -> None:
    if token:
        db.execute(delete(UserSession).where(UserSession.token == token))
        db.commit()


def role_at_least(role: str | None, needed: str) -> bool:
    return role is not None and ROLES.index(role) >= ROLES.index(needed)


def membership_role(db: Session, user: User, library_id: str) -> str | None:
    if user.is_admin:
        return "owner"
    m = db.scalar(select(Membership).where(Membership.user_id == user.id, Membership.library_id == library_id))
    return m.role if m else None

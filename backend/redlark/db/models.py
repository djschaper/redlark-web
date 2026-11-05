"""SQLAlchemy models. Used by Postgres when hosted and SQLite for offline desktop libraries."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), default="")
    password_hash: Mapped[str] = mapped_column(String(255))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    memberships: Mapped[list[Membership]] = relationship(back_populates="user", cascade="all, delete-orphan")


class UserSession(Base):
    __tablename__ = "user_sessions"
    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Library(Base):
    __tablename__ = "libraries"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255))
    set_song_path: Mapped[str] = mapped_column(String(255), default="/")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    memberships: Mapped[list[Membership]] = relationship(back_populates="library", cascade="all, delete-orphan")


ROLES = ("viewer", "editor", "owner")


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("user_id", "library_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    library_id: Mapped[str] = mapped_column(ForeignKey("libraries.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16), default="viewer")

    user: Mapped[User] = relationship(back_populates="memberships")
    library: Mapped[Library] = relationship(back_populates="memberships")


class SongRow(Base):
    __tablename__ = "songs"
    __table_args__ = (UniqueConstraint("library_id", "uuid"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    library_id: Mapped[str] = mapped_column(ForeignKey("libraries.id", ondelete="CASCADE"), index=True)
    uuid: Mapped[str] = mapped_column(String(36), index=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    author: Mapped[str] = mapped_column(String(500), default="")
    copyright: Mapped[str] = mapped_column(Text, default="")
    ccli: Mapped[str] = mapped_column(String(32), default="")
    key: Mapped[str] = mapped_column(String(8), default="")
    tempo: Mapped[str] = mapped_column(String(16), default="")
    time_sig: Mapped[str] = mapped_column(String(16), default="")
    capo: Mapped[str] = mapped_column(String(8), default="")
    link_youtube: Mapped[str] = mapped_column(String(500), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    lyrics: Mapped[str] = mapped_column(Text, default="")
    extra: Mapped[dict] = mapped_column(JSON, default=dict)
    field_order: Mapped[list] = mapped_column(JSON, default=list)
    last_modified: Mapped[str] = mapped_column(String(40), default="")


class SetRow(Base):
    __tablename__ = "sets"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    library_id: Mapped[str] = mapped_column(ForeignKey("libraries.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    last_modified: Mapped[str] = mapped_column(String(40), default="")

    items: Mapped[list[SetItemRow]] = relationship(
        back_populates="set", cascade="all, delete-orphan", order_by="SetItemRow.position"
    )


class SetItemRow(Base):
    __tablename__ = "set_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    set_id: Mapped[str] = mapped_column(ForeignKey("sets.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    song_id: Mapped[str | None] = mapped_column(ForeignKey("songs.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), default="")
    key: Mapped[str] = mapped_column(String(8), default="")
    type: Mapped[str] = mapped_column(String(32), default="song")
    attrs: Mapped[dict] = mapped_column(JSON, default=dict)

    set: Mapped[SetRow] = relationship(back_populates="items")

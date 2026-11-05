from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request

from ..auth import SESSION_COOKIE, role_at_least, user_for_token
from ..context import AppContext
from ..db.models import User
from ..storage.base import LibraryStore


def get_ctx(request: Request) -> AppContext:
    return request.app.state.ctx


def session_token(request: Request) -> str | None:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth[7:].strip()
    return token


def optional_user(request: Request, ctx: AppContext = Depends(get_ctx)) -> User | None:
    if ctx.mode == "local":
        return None
    assert ctx.sessions
    with ctx.sessions() as db:
        return user_for_token(db, session_token(request))


def current_user(request: Request, ctx: AppContext = Depends(get_ctx)) -> User | None:
    """Required login in server mode; no-op (None) in local mode."""
    if ctx.mode == "local":
        return None
    user = optional_user(request, ctx)
    if user is None:
        raise HTTPException(401, "Not logged in")
    return user


@dataclass
class LibraryAccess:
    id: str
    store: LibraryStore
    role: str

    def require(self, role: str) -> None:
        if not role_at_least(self.role, role):
            raise HTTPException(403, f"This needs {role} access to the library")


def library_access(
    library_id: str, ctx: AppContext = Depends(get_ctx), user: User | None = Depends(current_user)
) -> LibraryAccess:
    found = ctx.store_for(library_id, user)
    if found is None:
        raise HTTPException(404, "Library not found")
    store, role = found
    return LibraryAccess(library_id, store, role)


def editable_library(access: LibraryAccess = Depends(library_access)) -> LibraryAccess:
    access.require("editor")
    return access

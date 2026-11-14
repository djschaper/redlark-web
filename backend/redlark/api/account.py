"""App info, login/logout, library list & membership, and local (desktop) settings."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select

from .. import __version__
from ..auth import (
    SESSION_COOKIE,
    authenticate,
    create_user,
    end_session,
    membership_role,
    role_at_least,
    start_session,
)
from ..context import AppContext
from ..db.models import ROLES, Library, Membership, User
from ..local_settings import LocalLibrary, LocalSettings
from .deps import current_user, get_ctx, optional_user, session_token

router = APIRouter(prefix="/api", tags=["account"])


def _user_out(user: User | None) -> dict | None:
    if user is None:
        return None
    return {"id": user.id, "email": user.email, "name": user.name, "is_admin": user.is_admin}


@router.get("/info")
def info(ctx: AppContext = Depends(get_ctx), user: User | None = Depends(optional_user)):
    out = {
        "version": __version__,
        "mode": ctx.mode,
        "user": _user_out(user),
        "allow_signup": ctx.settings.allow_signup,
    }
    if ctx.mode == "local":
        assert ctx.local
        s = ctx.local.load()
        out.update(display_mode=s.display_mode, default_view=s.default_view, active_library=s.active_library)
    return out


# ---------------------------------------------------------------- auth (server mode)


class LoginIn(BaseModel):
    email: str
    password: str


class SignupIn(LoginIn):
    name: str = ""
    library_name: str = ""


def _set_cookie(response: Response, ctx: AppContext, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=ctx.settings.session_days * 86400,
        httponly=True,
        samesite="lax",
        secure=ctx.settings.cookie_secure,
    )


def _server_only(ctx: AppContext) -> None:
    if ctx.mode != "server":
        raise HTTPException(400, "Accounts are only used by the hosted app")


@router.post("/auth/login")
def login(data: LoginIn, response: Response, ctx: AppContext = Depends(get_ctx)):
    _server_only(ctx)
    assert ctx.sessions
    with ctx.sessions() as db:
        user = authenticate(db, data.email, data.password)
        if user is None:
            raise HTTPException(401, "Incorrect email or password")
        sess = start_session(db, user, ctx.settings.session_days)
        _set_cookie(response, ctx, sess.token)
        # The token is also returned so the desktop app can sync with this account.
        return {"user": _user_out(user), "token": sess.token}


@router.post("/auth/signup", status_code=201)
def signup(data: SignupIn, response: Response, ctx: AppContext = Depends(get_ctx)):
    _server_only(ctx)
    if not ctx.settings.allow_signup:
        raise HTTPException(403, "Sign-up is disabled. Ask a library owner to invite you.")
    assert ctx.sessions
    with ctx.sessions() as db:
        try:
            user = create_user(db, data.email, data.password, data.name)
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        lib = Library(name=data.library_name or f"{user.name}'s library")
        db.add(lib)
        db.flush()
        db.add(Membership(user_id=user.id, library_id=lib.id, role="owner"))
        db.commit()
        sess = start_session(db, user, ctx.settings.session_days)
        _set_cookie(response, ctx, sess.token)
        return {"user": _user_out(user), "token": sess.token}


@router.post("/auth/logout", status_code=204)
def logout(request: Request, response: Response, ctx: AppContext = Depends(get_ctx)):
    if ctx.mode == "server":
        assert ctx.sessions
        with ctx.sessions() as db:
            end_session(db, session_token(request))
    response.delete_cookie(SESSION_COOKIE)


# ---------------------------------------------------------------- libraries


@router.get("/libraries")
def libraries(ctx: AppContext = Depends(get_ctx), user: User | None = Depends(current_user)):
    return [lib.__dict__ for lib in ctx.libraries_for(user)]


class LibraryIn(BaseModel):
    name: str = Field(min_length=1)
    # Local mode only:
    kind: Literal["folder", "sqlite"] = "sqlite"
    path: str = ""
    set_song_path: str = "/"


@router.post("/libraries", status_code=201)
def create_library(data: LibraryIn, ctx: AppContext = Depends(get_ctx), user: User | None = Depends(current_user)):
    if ctx.mode == "local":
        assert ctx.local
        settings = ctx.local.load()
        path = data.path.strip()
        if data.kind == "folder":
            if not path or not Path(path).is_dir():
                raise HTTPException(400, "Choose an existing OpenSong folder (the one containing Songs/ and Sets/)")
        elif not path:
            path = str(ctx.settings.data_dir / "libraries" / f"{LocalLibrary(name='x', kind='sqlite', path='').id}.db")
        lib = LocalLibrary(name=data.name, kind=data.kind, path=path, set_song_path=data.set_song_path or "/")
        settings.libraries.append(lib)
        if not settings.active_library:
            settings.active_library = lib.id
        ctx.local.save(settings)
        return {"id": lib.id, "name": lib.name, "role": "owner", "kind": lib.kind, "path": lib.path}
    assert ctx.sessions and user
    with ctx.sessions() as db:
        lib = Library(name=data.name)
        db.add(lib)
        db.flush()
        db.add(Membership(user_id=user.id, library_id=lib.id, role="owner"))
        db.commit()
        return {"id": lib.id, "name": lib.name, "role": "owner", "kind": "sql"}


class LibraryPatch(BaseModel):
    name: str | None = None
    set_song_path: str | None = None
    path: str | None = None


def _owner(ctx: AppContext, user: User | None, library_id: str) -> None:
    if ctx.mode == "local":
        return
    assert ctx.sessions and user
    with ctx.sessions() as db:
        if not role_at_least(membership_role(db, user, library_id), "owner"):
            raise HTTPException(403, "Only library owners can do that")


@router.patch("/libraries/{library_id}")
def update_library(
    library_id: str, data: LibraryPatch, ctx: AppContext = Depends(get_ctx), user: User | None = Depends(current_user)
):
    _owner(ctx, user, library_id)
    if ctx.mode == "local":
        assert ctx.local
        settings = ctx.local.load()
        lib = next((lib for lib in settings.libraries if lib.id == library_id), None)
        if lib is None:
            raise HTTPException(404, "Library not found")
        for field in ("name", "set_song_path", "path"):
            if getattr(data, field) is not None:
                setattr(lib, field, getattr(data, field))
        ctx.local.save(settings)
        return {"id": lib.id, "name": lib.name}
    assert ctx.sessions
    with ctx.sessions() as db:
        lib = db.get(Library, library_id)
        if lib is None:
            raise HTTPException(404, "Library not found")
        if data.name is not None:
            lib.name = data.name
        if data.set_song_path is not None:
            lib.set_song_path = data.set_song_path
        db.commit()
        return {"id": lib.id, "name": lib.name}


@router.delete("/libraries/{library_id}", status_code=204)
def delete_library(library_id: str, ctx: AppContext = Depends(get_ctx), user: User | None = Depends(current_user)):
    """Local: forgets the library (files are left alone). Server: deletes it."""
    _owner(ctx, user, library_id)
    if ctx.mode == "local":
        assert ctx.local
        settings = ctx.local.load()
        settings.libraries = [lib for lib in settings.libraries if lib.id != library_id]
        if settings.active_library == library_id:
            settings.active_library = settings.libraries[0].id if settings.libraries else ""
        ctx.local.save(settings)
        return
    assert ctx.sessions
    with ctx.sessions() as db:
        lib = db.get(Library, library_id)
        if lib:
            db.delete(lib)
            db.commit()


class MemberIn(BaseModel):
    email: str
    role: Literal["viewer", "editor", "owner"] = "viewer"
    # When the email has no account yet, create one with this password.
    password: str = ""
    name: str = ""


@router.get("/libraries/{library_id}/members")
def list_members(library_id: str, ctx: AppContext = Depends(get_ctx), user: User | None = Depends(current_user)):
    _server_only(ctx)
    assert ctx.sessions and user
    with ctx.sessions() as db:
        if membership_role(db, user, library_id) is None:
            raise HTTPException(404, "Library not found")
        rows = db.execute(
            select(User, Membership.role)
            .join(Membership)
            .where(Membership.library_id == library_id)
            .order_by(User.email)
        ).all()
        return [{**_user_out(u), "role": role} for u, role in rows]


@router.post("/libraries/{library_id}/members", status_code=201)
def add_member(
    library_id: str, data: MemberIn, ctx: AppContext = Depends(get_ctx), user: User | None = Depends(current_user)
):
    _server_only(ctx)
    _owner(ctx, user, library_id)
    assert ctx.sessions
    with ctx.sessions() as db:
        member = db.scalar(select(User).where(User.email == data.email.strip().lower()))
        if member is None:
            if not data.password:
                raise HTTPException(400, "No account with that email. Give a starting password to create one.")
            try:
                member = create_user(db, data.email, data.password, data.name)
            except ValueError as exc:
                raise HTTPException(400, str(exc))
        m = db.scalar(select(Membership).where(Membership.user_id == member.id, Membership.library_id == library_id))
        if m is None:
            db.add(Membership(user_id=member.id, library_id=library_id, role=data.role))
        else:
            m.role = data.role
        db.commit()
        return {**_user_out(member), "role": data.role}


@router.delete("/libraries/{library_id}/members/{user_id}", status_code=204)
def remove_member(
    library_id: str, user_id: str, ctx: AppContext = Depends(get_ctx), user: User | None = Depends(current_user)
):
    _server_only(ctx)
    _owner(ctx, user, library_id)
    assert ctx.sessions
    with ctx.sessions() as db:
        owners = db.scalars(
            select(Membership).where(Membership.library_id == library_id, Membership.role == "owner")
        ).all()
        m = db.scalar(select(Membership).where(Membership.user_id == user_id, Membership.library_id == library_id))
        if m is None:
            return
        if m.role == "owner" and len(owners) <= 1:
            raise HTTPException(400, "A library needs at least one owner")
        db.delete(m)
        db.commit()


# ---------------------------------------------------------------- local settings


class SettingsPatch(BaseModel):
    online_url: str | None = None
    display_mode: Literal["light", "dark"] | None = None
    default_view: Literal["chords", "lyrics"] | None = None
    active_library: str | None = None


def _public_settings(s: LocalSettings) -> dict:
    d = s.model_dump()
    d["remote_token"] = bool(s.remote_token)
    return d


@router.get("/settings")
def get_local_settings(ctx: AppContext = Depends(get_ctx)):
    if ctx.mode != "local":
        raise HTTPException(404, "Not available")
    assert ctx.local
    return _public_settings(ctx.local.load())


@router.patch("/settings")
def patch_local_settings(data: SettingsPatch, ctx: AppContext = Depends(get_ctx)):
    if ctx.mode != "local":
        raise HTTPException(404, "Not available")
    assert ctx.local
    s = ctx.local.load()
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    ctx.local.save(s)
    return _public_settings(s)


ROLES_ORDER = ROLES


# ---------------------------------------------------------------- conversion (song editor)


class ConvertIn(BaseModel):
    text: str
    to: Literal["opensong", "chordpro"]


@router.post("/convert")
def convert(data: ConvertIn):
    """Convert a song body between OpenSong lyrics text and ChordPro (for the editor's format toggle)."""
    from ..core.chordpro import parse_chordpro, song_to_chordpro
    from ..core.model import Song
    from ..core.opensong import parse_lyrics, sections_to_lyrics

    if data.to == "chordpro":
        cho = song_to_chordpro(Song(lyrics=sections_to_lyrics(parse_lyrics(data.text))))
        # Drop the {title: } line the exporter always writes; metadata lives in the form fields.
        body = "\n".join(line for line in cho.splitlines() if not line.startswith("{title:"))
        return {"text": body.strip() + "\n"}
    return {"text": parse_chordpro(data.text).lyrics}

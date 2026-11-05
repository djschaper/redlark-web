"""FastAPI application factory. Serves the JSON API and the built Vue single-page app."""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import __version__
from .config import Settings, get_settings
from .context import AppContext
from .render.pdf import PdfUnavailable

log = logging.getLogger("redlark")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title="Redlark", version=__version__)
    app.state.ctx = AppContext(settings)

    from .api import account, library, sync

    app.include_router(account.router)
    app.include_router(library.router)
    app.include_router(sync.router)

    @app.exception_handler(PermissionError)
    async def _perm(_: Request, exc: PermissionError):
        return JSONResponse({"detail": str(exc) or "Not allowed"}, status_code=403)

    @app.exception_handler(PdfUnavailable)
    async def _pdf(_: Request, exc: PdfUnavailable):
        return JSONResponse({"detail": str(exc)}, status_code=503)

    static = Path(settings.static_dir) if settings.static_dir else Path(__file__).resolve().parent / "static"
    index = static / "index.html"
    if (static / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=static / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404)
        candidate = (static / path).resolve()
        if path and candidate.is_file() and static.resolve() in candidate.parents:
            return FileResponse(candidate)
        if index.exists():
            return FileResponse(index, headers={"Cache-Control": "no-cache"})
        return JSONResponse({"detail": "Frontend not built. Run `npm run build` in frontend/."}, status_code=404)

    return app

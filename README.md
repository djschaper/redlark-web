# Redlark

Plan worship sets from an OpenSong song library: browse and search songs, preview them in any
key, with chords or lyrics only, build sets, and print/export them.

Version 2 runs two ways from one codebase:

| | Where data lives | Accounts |
|---|---|---|
| **Website** (hosted) | Postgres, shared team libraries | Email + password; roles *viewer / editor / owner* |
| **Desktop** | An OpenSong folder (`Songs/`, `Sets/`, read and written in place, so OpenSong itself keeps working) or a local library file | None (optionally a website account, for sync) |

The desktop app always runs its own bundled UI, so it never changes when the website is updated.
To share with a team, connect it to your website account and link a desktop library to an online
library; the two then **sync** both ways (Settings → Sync with an online account). Songs match
by their OpenSong `uuid`, sets by name; anything changed on both sides since the last sync is
listed so you can choose which version to keep. Deletions are not synced.

## Features

- Song list with search and the "recently used" dot (fades over the last 12 dated sets)
- Preview with key transposition, **chords / lyrics-only** toggle, dark mode, YouTube link
- Sets: drag songs in (or tap **+** on phones), reorder, choose a key per song, save/open
  (OpenSong set files), print, PDF, copy an *Order / Song / Key* table with YouTube links
- **Import** OpenSong songs/sets and **ChordPro** files (`.cho .chordpro .chopro .pro .crd`),
  individually, as folders, or zipped
- **Export** one song, a selection, a set, or the whole library as **OpenSong**, **ChordPro**,
  **PDF** (chords or lyrics only) or a **self-contained HTML** page (with its own key selector)
- Song editor (OpenSong or ChordPro syntax)
- Phone-friendly layout: below 900px the Songs / Set / Preview panels become tabs

## Layout

```
backend/    Python package `redlark`: FastAPI API, Typer CLI, parsers, storage, sync, desktop shell
  redlark/core/      OpenSong + ChordPro parsing, transposition, lyrics-only projection
  redlark/storage/   OpenSong folder store and SQL store (Postgres / SQLite)
  redlark/api/       HTTP routes
  redlark/render/    payloads for the renderer, HTML documents, PDF via Playwright
  packaging/         PyInstaller spec + Inno Setup installer script
frontend/   Vue 3 + Vite + TypeScript
  src/components/SongSheet.vue   the one song renderer (preview, print, PDF and HTML export)
  standalone/                    single-file viewer used for exported HTML and PDFs
shared/fixtures/   test data used by both pytest and vitest
legacy/     Redlark v1 (Electron) for reference; to be removed
```

## Developing

Requirements: Python 3.11+ with [uv](https://docs.astral.sh/uv/), Node **22.12+** (or 20.19+),
and Microsoft Edge or Chrome for PDFs (or `uv run playwright install chromium`).

```bash
cd frontend && npm install && npm run build      # builds into backend/redlark/static
cd backend && uv sync
```

Run the offline/local app against an OpenSong folder (use a *copy* while developing):

```bash
uv --directory backend run redlark serve --mode local --library "D:/path/to/OpenSong" --data-dir ./.devdata
```

For frontend hot reload, run that on port 8000 and `npm run dev` in `frontend/` (proxies `/api`).

Run the hosted mode locally with SQLite:

```bash
REDLARK_MODE=server REDLARK_ALLOW_SIGNUP=true uv --directory backend run redlark serve
```

Tests:

```bash
uv --directory backend run pytest
npm --prefix frontend test
```

### CLI

```bash
redlark serve        # web app (local or server mode)
redlark desktop      # desktop window
redlark export LIBRARY OUT -f opensong|chordpro|pdf|html [--song NAME]... [--set NAME] [--lyrics] [--combine]
redlark import LIBRARY FILES... [--overwrite]
redlark migrate      # Postgres schema (Alembic)
redlark create-user EMAIL --library "Church name" [--admin]
redlark upload-library OPENSONG_FOLDER LIBRARY_ID   # bulk copy into a hosted library
```

`LIBRARY` is an OpenSong folder or a `.db` file.

## Configuration (environment, prefix `REDLARK_`)

| Variable | Default | |
|---|---|---|
| `MODE` | `local` | `server` = hosted with accounts |
| `DATABASE_URL` | `sqlite:///./redlark.db` | e.g. `postgresql+psycopg://user:pass@host/db` |
| `DATA_DIR` | `%APPDATA%\RedlarkV2` | local mode settings |
| `ALLOW_SIGNUP` | `false` | let anyone create an account + library |
| `COOKIE_SECURE` | `false` | set `true` behind HTTPS |
| `SESSION_DAYS` | `30` | |
| `PDF_BROWSER_CHANNEL` | *(auto)* | `chromium`, `msedge` or `chrome` |

On first start the desktop app picks up the OpenSong folder and dark-mode setting from Redlark v1.

## Deploying the website (AWS)

The `Dockerfile` builds one image (Vue app + FastAPI + Chromium for PDFs). It runs migrations on
start. `docker compose up --build` runs it locally with Postgres.

On AWS: an ECR repository, an RDS Postgres instance, and an App Runner service (port 8000) using
the image, with `REDLARK_DATABASE_URL` and `REDLARK_COOKIE_SECURE=true` set. The **Deploy to
AWS** GitHub workflow builds, pushes and redeploys (see the comments in
`.github/workflows/deploy.yml` for the required settings). Then create the first account:

```bash
redlark create-user you@example.org --library "Church name"
redlark upload-library "D:/path/to/OpenSong" <library id>
```

## Desktop releases

Tag `v2.x.y` and push: CI builds `Redlark-Setup-<version>.exe` (PyInstaller + Inno Setup) into a
draft GitHub release. The app checks GitHub releases on start and shows a banner when a newer
version exists. Locally:

```bash
cd frontend && npm run build
cd backend && uv sync --extra desktop && uv run pyinstaller packaging/redlark.spec --noconfirm
iscc packaging/installer.iss
```

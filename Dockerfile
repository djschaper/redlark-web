# Hosted Redlark: FastAPI serving the built Vue app, Postgres for data, Chromium for PDFs.

# ---- frontend -------------------------------------------------------------
FROM node:22-slim AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY shared/ /src/shared/
RUN npm run build   # writes /src/backend/redlark/static

# ---- app ------------------------------------------------------------------
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
RUN uv run playwright install --with-deps chromium
COPY backend/ ./
COPY --from=frontend /src/backend/redlark/static ./redlark/static
RUN uv sync --frozen --no-dev

ENV REDLARK_MODE=server \
    REDLARK_PDF_BROWSER_CHANNEL=chromium \
    REDLARK_COOKIE_SECURE=true \
    PORT=8000
EXPOSE 8000
RUN useradd --create-home redlark && chown -R redlark /app /ms-playwright
USER redlark
CMD ["sh", "-c", "uv run --no-sync redlark migrate && uv run --no-sync uvicorn redlark.app:create_app --factory --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]

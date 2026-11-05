"""PDF rendering with Playwright (headless Chromium, or the system Edge/Chrome on desktops)."""

from __future__ import annotations

import logging

from ..config import get_settings

log = logging.getLogger(__name__)

# Same page setup as v1 (src/lib/pdf.js).
PDF_OPTIONS = {
    "format": "Letter",
    "margin": {"top": "0.5in", "bottom": "0.3in", "left": "0.5in", "right": "0.5in"},
    "print_background": True,
}


class PdfUnavailable(RuntimeError):
    pass


def _launch(p):
    channel = get_settings().pdf_browser_channel
    attempts = [channel] if channel else [None, "msedge", "chrome"]
    errors = []
    for ch in attempts:
        try:
            return p.chromium.launch(channel=ch) if ch else p.chromium.launch()
        except Exception as exc:  # browser not installed: try the next one
            errors.append(f"{ch or 'chromium'}: {exc.__class__.__name__}")
    raise PdfUnavailable(
        "No browser available for PDF rendering (" + "; ".join(errors) + "). "
        "Run `uv run playwright install chromium`, or install Microsoft Edge / Google Chrome."
    )


def html_to_pdf(document: str) -> bytes:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:  # pragma: no cover
        raise PdfUnavailable("playwright is not installed") from exc

    with sync_playwright() as p:
        browser = _launch(p)
        try:
            page = browser.new_page()
            page.set_content(document, wait_until="load")
            page.wait_for_function("window.__REDLARK_READY__ === true", timeout=15000)
            page.emulate_media(media="print")
            return page.pdf(**PDF_OPTIONS)
        finally:
            browser.close()

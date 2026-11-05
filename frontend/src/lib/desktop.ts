// Bridge to the pywebview desktop shell (backend/redlark/desktop.py). Absent in the browser.

interface DesktopApi {
  pick_folder(): Promise<string>
  open_external(url: string): Promise<void>
  update_info(): Promise<{ version: string; url: string } | null>
  go_offline(): Promise<void>
  go_online(): Promise<void>
}

declare global {
  interface Window {
    pywebview?: { api: DesktopApi }
  }
}

export function desktop(): Promise<DesktopApi | null> {
  if (window.pywebview?.api) return Promise.resolve(window.pywebview.api)
  return new Promise((resolve) => {
    const done = () => resolve(window.pywebview?.api ?? null)
    window.addEventListener('pywebviewready', done, { once: true })
    setTimeout(done, 1500)
  })
}

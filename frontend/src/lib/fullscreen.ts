import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/**
 * Full-screen toggle for an element. Uses the Fullscreen API where available and falls back to a
 * CSS "fills the window" mode (iPhone Safari has no element fullscreen).
 *
 * With `shortcutTarget`, Ctrl/Cmd+F toggles full screen: it exits when active, otherwise enters
 * on the element `shortcutTarget` returns. When that is null, the key is left to the browser's Find.
 */
export function useFullscreen(
  target: Ref<HTMLElement | null>,
  options: { shortcutTarget?: () => HTMLElement | null } = {},
) {
  const active = ref(false)
  const native = ref(false)

  const sync = () => {
    if (native.value && !document.fullscreenElement) {
      native.value = false
      active.value = false
    }
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && active.value && !native.value) {
      exit()
      return
    }
    const isShortcut =
      (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f'
    if (!isShortcut || !options.shortcutTarget || e.defaultPrevented) return
    if (active.value) {
      e.preventDefault()
      exit()
      return
    }
    const el = options.shortcutTarget()
    if (!el) return
    e.preventDefault()
    target.value = el
    enter()
  }

  async function enter() {
    const el = target.value
    if (!el) return
    if (el.requestFullscreen && document.fullscreenEnabled) {
      try {
        await el.requestFullscreen({ navigationUI: 'hide' })
        native.value = true
        active.value = true
        return
      } catch {
        /* fall back to CSS mode */
      }
    }
    native.value = false
    active.value = true
  }

  async function exit() {
    if (native.value && document.fullscreenElement) await document.exitFullscreen().catch(() => {})
    native.value = false
    active.value = false
  }

  const toggle = () => (active.value ? exit() : enter())

  onMounted(() => {
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('keydown', onKey)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', sync)
    document.removeEventListener('keydown', onKey)
  })

  return { active, toggle, exit }
}

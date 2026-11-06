import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/**
 * Full-screen toggle for an element. Uses the Fullscreen API where available and falls back to a
 * CSS "fills the window" mode (iPhone Safari has no element fullscreen).
 */
export function useFullscreen(target: Ref<HTMLElement | null>) {
  const active = ref(false)
  const native = ref(false)

  const sync = () => {
    if (native.value && !document.fullscreenElement) {
      native.value = false
      active.value = false
    }
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && active.value && !native.value) exit()
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

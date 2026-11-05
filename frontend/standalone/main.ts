import { createApp } from 'vue'
import Standalone from './Standalone.vue'
import type { StandaloneData } from '../src/lib/types'

const el = document.getElementById('redlark-data')
const fallback: StandaloneData = { title: 'Redlark', songs: [], mode: 'chords', print: false, dark: false }
let data = fallback
try {
  data = el && el.textContent?.trim() ? (JSON.parse(el.textContent) as StandaloneData) : fallback
} catch {
  data = fallback
}
createApp(Standalone, { data }).mount('#app')

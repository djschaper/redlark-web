<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, type SongInput } from '../lib/api'
import { ALL_KEYS } from '../lib/chords'
import { useAppStore } from '../stores/app'
import { usePreviewStore } from '../stores/preview'

const props = defineProps<{ id?: string }>()
const app = useAppStore()
const preview = usePreviewStore()
const router = useRouter()

const form = reactive<SongInput>({
  title: '', author: '', copyright: '', ccli: '', key: '', tempo: '', time_sig: '', capo: '',
  link_youtube: '', notes: '', lyrics: '', chordpro: null,
})
const format = ref<'opensong' | 'chordpro'>('opensong')
const body = ref('')
const saving = ref(false)
const loaded = ref(!props.id)

onMounted(async () => {
  if (!props.id) {
    body.value = '[V1]\n.G         C        G\n Amazing grace how sweet the sound\n\n[C]\n.C        G\n Chorus line here'
    return
  }
  try {
    const s = await api.song(app.libraryId, props.id)
    for (const k of Object.keys(form) as (keyof SongInput)[]) {
      if (k !== 'chordpro') (form[k] as string) = (s as unknown as Record<string, string>)[k] ?? ''
    }
    body.value = s.lyrics
    loaded.value = true
  } catch (e) {
    app.fail(e)
  }
})

async function switchFormat(to: 'opensong' | 'chordpro') {
  if (to === format.value) return
  // The server converts, so the editor uses the same parser as import/export.
  try {
    body.value = await api.convert(body.value, to)
    format.value = to
  } catch (e) {
    app.fail(e)
  }
}

async function save() {
  saving.value = true
  try {
    const data: SongInput = { ...form, lyrics: format.value === 'opensong' ? body.value : '', chordpro: format.value === 'chordpro' ? body.value : null }
    const saved = props.id ? await api.updateSong(app.libraryId, props.id, data) : await api.createSong(app.libraryId, data)
    if (props.id && saved.id !== props.id) preview.forget(props.id)
    preview.replace(saved)
    await app.loadSongs()
    app.notify('Song saved')
    router.push('/')
  } catch (e) {
    app.fail(e)
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!props.id || !confirm(`Delete "${form.title}"? This can't be undone.`)) return
  try {
    await api.deleteSong(app.libraryId, props.id)
    preview.forget(props.id)
    await app.loadSongs()
    router.push('/')
  } catch (e) {
    app.fail(e)
  }
}
</script>

<template>
  <div class="form-page">
    <div class="panel" v-if="loaded">
      <h2>{{ id ? 'Edit song' : 'New song' }}</h2>
      <div class="edit-grid">
        <div class="field wide"><label>Title</label><input v-model="form.title" class="text-input" required /></div>
        <div class="field wide"><label>Author</label><input v-model="form.author" class="text-input" /></div>
        <div class="field">
          <label>Key</label>
          <select v-model="form.key" class="text-input">
            <option value="">—</option>
            <option v-for="k in ALL_KEYS" :key="k" :value="k">{{ k }}</option>
          </select>
        </div>
        <div class="field"><label>Tempo</label><input v-model="form.tempo" class="text-input" /></div>
        <div class="field"><label>Time</label><input v-model="form.time_sig" class="text-input" placeholder="4/4" /></div>
        <div class="field"><label>Capo</label><input v-model="form.capo" class="text-input" /></div>
        <div class="field"><label>CCLI #</label><input v-model="form.ccli" class="text-input" /></div>
        <div class="field wide"><label>Copyright</label><input v-model="form.copyright" class="text-input" /></div>
        <div class="field wide"><label>YouTube link</label><input v-model="form.link_youtube" class="text-input" placeholder="Leave empty to search YouTube" /></div>
      </div>
      <div class="field">
        <div class="row">
          <span class="label">Lyrics &amp; chords</span>
          <label><input type="radio" :checked="format === 'opensong'" @change="switchFormat('opensong')" /> OpenSong</label>
          <label><input type="radio" :checked="format === 'chordpro'" @change="switchFormat('chordpro')" /> ChordPro</label>
        </div>
        <small class="muted" v-if="format === 'opensong'">
          <code>[V1]</code> section headers · lines starting with <code>.</code> are chords, aligned above the lyric line
          below (which starts with a space) · <code>;</code> comments
        </small>
        <small class="muted" v-else>Inline chords like <code>[G]Amazing [C]grace</code>, <code>{start_of_chorus}</code> … <code>{end_of_chorus}</code>, <code>{comment: Verse 2}</code>. Converted to OpenSong format when saved.</small>
        <textarea v-model="body" class="text-input lyrics-editor" spellcheck="false"></textarea>
      </div>
      <div class="field"><label>Notes</label><textarea v-model="form.notes" class="text-input" rows="2"></textarea></div>
      <div class="row">
        <button class="btn" :disabled="saving || !form.title.trim()" @click="save">Save</button>
        <button class="btn secondary" @click="router.back()">Cancel</button>
        <span style="flex: 1"></span>
        <button v-if="id" class="btn danger" @click="remove">Delete</button>
      </div>
    </div>
    <div v-else class="loader"></div>
  </div>
</template>

<style>
.edit-grid {
  display: grid;
  /* minmax(0, …): inputs have a default intrinsic width that would otherwise stop the columns shrinking. */
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0 12px;
}

.edit-grid .field {
  min-width: 0;
}

.edit-grid .wide {
  grid-column: span 2;
}

.lyrics-editor {
  font-family: Consolas, 'Courier New', monospace;
  min-height: 420px;
  white-space: pre;
  overflow: auto;
  tab-size: 4;
  font-size: 14px;
  line-height: 1.35;
}

@media (max-width: 700px) {
  .edit-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .lyrics-editor {
    min-height: 300px;
  }
}
</style>

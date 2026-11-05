<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Icon from '../components/Icon.vue'
import { api, saveBlob, type ImportPreview, type ImportResult } from '../lib/api'
import type { ExportFormat, ViewMode } from '../lib/types'
import { useAppStore } from '../stores/app'
import { usePreviewStore } from '../stores/preview'

const app = useAppStore()
const preview = usePreviewStore()

// ---------------------------------------------------------------- members
type Member = { id: string; name: string; email: string; role: string }
const members = ref<Member[]>([])
const memberEmail = ref('')
const memberRole = ref('editor')
const memberPassword = ref('')
const isOwner = computed(() => app.library?.role === 'owner')

async function loadMembers() {
  members.value = []
  if (app.isLocal || !app.libraryId) return
  try {
    members.value = (await api.members(app.libraryId)) as Member[]
  } catch (e) {
    app.fail(e)
  }
}
watch(() => app.libraryId, loadMembers, { immediate: true })

async function addMember() {
  try {
    await api.addMember(app.libraryId, { email: memberEmail.value, role: memberRole.value, password: memberPassword.value })
    memberEmail.value = memberPassword.value = ''
    await loadMembers()
  } catch (e) {
    app.fail(e)
  }
}

async function setRole(m: Member, role: string) {
  try {
    await api.addMember(app.libraryId, { email: m.email, role })
    await loadMembers()
  } catch (e) {
    app.fail(e)
  }
}

async function removeMember(m: Member) {
  if (!confirm(`Remove ${m.email} from this library?`)) return
  try {
    await api.removeMember(app.libraryId, m.id)
    await loadMembers()
  } catch (e) {
    app.fail(e)
  }
}

async function newOnlineLibrary() {
  const name = prompt('Name for the new library')
  if (!name) return
  try {
    const lib = await api.createLibrary({ name })
    await app.loadLibraries()
    app.libraryId = lib.id
  } catch (e) {
    app.fail(e)
  }
}

// ---------------------------------------------------------------- import
const files = ref<File[]>([])
const importPreview = ref<ImportPreview | null>(null)
const decisions = ref<Record<string, string>>({})
const importing = ref(false)

function pick(e: Event) {
  const input = e.target as HTMLInputElement
  files.value = [...files.value, ...Array.from(input.files || [])]
  input.value = ''
  analyse()
}

async function analyse() {
  if (!files.value.length) return
  importing.value = true
  try {
    importPreview.value = (await api.importFiles(app.libraryId, files.value, false)) as ImportPreview
    decisions.value = Object.fromEntries(
      importPreview.value.items.map((i) => [i.source, i.existing_id ? 'skip' : 'new']),
    )
  } catch (e) {
    app.fail(e)
  } finally {
    importing.value = false
  }
}

async function commitImport() {
  importing.value = true
  try {
    const res = (await api.importFiles(app.libraryId, files.value, true, decisions.value)) as ImportResult
    app.notify(`Imported ${res.songs} songs and ${res.sets} sets (${res.skipped} skipped, ${res.errors} errors)`)
    files.value = []
    importPreview.value = null
    preview.forget()
    await app.loadSongs()
  } catch (e) {
    app.fail(e)
  } finally {
    importing.value = false
  }
}

// ---------------------------------------------------------------- export
const selected = ref<Set<string>>(new Set())
const filter = ref('')
const exportFormat = ref<ExportFormat>('opensong')
const exportMode = ref<ViewMode>('chords')
const combine = ref(true)
const exporting = ref(false)

const shown = computed(() => {
  const q = filter.value.trim().toLowerCase()
  return q ? app.songs.filter((s) => s.title.toLowerCase().includes(q)) : app.songs
})

function toggle(id: string) {
  const s = new Set(selected.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selected.value = s
}

function selectAll(on: boolean) {
  selected.value = on ? new Set(shown.value.map((s) => s.id)) : new Set()
}

async function exportSelected(all: boolean) {
  exporting.value = true
  try {
    const items = all ? undefined : app.songs.filter((s) => selected.value.has(s.id)).map((s) => ({ song_id: s.id, key: '' }))
    saveBlob(
      await api.export(app.libraryId, {
        format: exportFormat.value,
        mode: exportMode.value,
        all,
        items,
        combine: combine.value,
        name: all ? app.library?.name || 'Library' : 'Songs',
      }),
    )
  } catch (e) {
    app.fail(e)
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="form-page">
    <div class="panel">
      <h2>
        {{ app.library?.name || 'Library' }}
        <button v-if="!app.isLocal" class="btn secondary" @click="newOnlineLibrary"><Icon name="plus" /> New library</button>
      </h2>

      <template v-if="!app.isLocal">
        <h3>Team</h3>
        <table class="data">
          <tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr>
          <tr v-for="m in members" :key="m.id">
            <td>{{ m.name }}</td>
            <td>{{ m.email }}</td>
            <td>
              <select v-if="isOwner" class="text-input" :value="m.role" @change="setRole(m, ($event.target as HTMLSelectElement).value)">
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="owner">Owner</option>
              </select>
              <span v-else>{{ m.role }}</span>
            </td>
            <td><button v-if="isOwner" class="btn secondary" @click="removeMember(m)">Remove</button></td>
          </tr>
        </table>
        <div v-if="isOwner" class="row" style="margin: 10px 0 20px">
          <input v-model="memberEmail" class="text-input" type="email" placeholder="Email" />
          <select v-model="memberRole" class="text-input">
            <option value="viewer">Viewer — view & export</option>
            <option value="editor">Editor — edit songs & sets</option>
            <option value="owner">Owner — manage team</option>
          </select>
          <input v-model="memberPassword" class="text-input" type="text" placeholder="Starting password (new accounts)" />
          <button class="btn" @click="addMember">Add</button>
        </div>
      </template>

      <template v-if="app.canEdit">
        <h3>Import</h3>
        <p class="muted">OpenSong song or set files, ChordPro files (.cho, .chordpro, .pro, .crd), or zips of them.</p>
        <div class="row">
          <label class="btn"><Icon name="upload" /> Choose files
            <input type="file" multiple hidden accept=".cho,.chordpro,.chopro,.pro,.crd,.txt,.xml,.zip,*" @change="pick" />
          </label>
          <label class="btn secondary"><Icon name="folderOpen" /> Choose a folder
            <input type="file" multiple hidden webkitdirectory @change="pick" />
          </label>
          <span v-if="importing" class="mini-loader"></span>
        </div>
        <div v-if="importPreview" class="import-preview">
          <table class="data">
            <tr><th>Item</th><th>Format</th><th>Action</th></tr>
            <tr v-for="item in importPreview.items" :key="item.source">
              <td>{{ item.kind === 'set' ? 'Set: ' : '' }}{{ item.title }}<br /><small class="muted">{{ item.source }}</small></td>
              <td>{{ item.format === 'chordpro' ? 'ChordPro' : 'OpenSong' }}</td>
              <td>
                <span v-if="item.error" class="error-text">{{ item.error }}</span>
                <select v-else-if="item.existing_id" v-model="decisions[item.source]" class="text-input">
                  <option value="skip">Exists — skip</option>
                  <option value="overwrite">Exists — replace</option>
                  <option value="new">Exists — keep both</option>
                </select>
                <span v-else>New</span>
              </td>
            </tr>
          </table>
          <p v-if="!importPreview.items.length" class="muted">No songs or sets found in those files.</p>
          <div class="row" style="margin-top: 10px">
            <button class="btn" :disabled="importing || !importPreview.items.length" @click="commitImport">Import</button>
            <button class="btn secondary" @click="importPreview = null; files = []">Cancel</button>
          </div>
        </div>
      </template>

      <h3 style="margin-top: 24px">Export</h3>
      <div class="row">
        <select v-model="exportFormat" class="text-input">
          <option value="opensong">OpenSong</option>
          <option value="chordpro">ChordPro</option>
          <option value="pdf">PDF</option>
          <option value="html">Web page (HTML)</option>
        </select>
        <template v-if="exportFormat === 'pdf' || exportFormat === 'html'">
          <select v-model="exportMode" class="text-input">
            <option value="chords">With chords</option>
            <option value="lyrics">Lyrics only</option>
          </select>
          <label><input type="checkbox" v-model="combine" /> One file</label>
        </template>
        <button class="btn" :disabled="exporting || !selected.size" @click="exportSelected(false)">
          Export {{ selected.size }} selected
        </button>
        <button class="btn secondary" :disabled="exporting" @click="exportSelected(true)">Export whole library</button>
        <span v-if="exporting" class="mini-loader"></span>
      </div>
      <div class="row" style="margin: 10px 0 6px">
        <input v-model="filter" class="text-input" type="search" placeholder="Filter songs" />
        <button class="btn secondary" @click="selectAll(true)">Select all</button>
        <button class="btn secondary" @click="selectAll(false)">Clear</button>
      </div>
      <ul class="object-list export-list">
        <li v-for="s in shown" :key="s.id">
          <label><input type="checkbox" :checked="selected.has(s.id)" @change="toggle(s.id)" /> {{ s.title }}</label>
        </li>
      </ul>
    </div>
  </div>
</template>

<style>
.form-page h3 {
  color: var(--heading);
  margin: 16px 0 8px;
}

.import-preview {
  margin-top: 12px;
}

.export-list {
  max-height: 320px;
  min-height: 120px;
}

.export-list li {
  padding: 3px 4px;
  color: var(--item-text);
}

label.btn {
  cursor: pointer;
}
</style>

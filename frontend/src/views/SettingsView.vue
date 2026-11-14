<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, type LocalSettings, type SyncPreview } from '../lib/api'
import type { LibraryInfo } from '../lib/types'
import { desktop } from '../lib/desktop'
import { useAppStore } from '../stores/app'

const app = useAppStore()
const settings = ref<LocalSettings | null>(null)

// New local library form
const newName = ref('')
const newKind = ref<'folder' | 'sqlite'>('folder')
const newPath = ref('')

// Online connection
const onlineUrl = ref('')
const onlineEmail = ref('')
const onlinePassword = ref('')
const remoteLibs = ref<LibraryInfo[]>([])

// Sync
const syncing = ref<string>('')
const plan = ref<SyncPreview | null>(null)
const resolutions = ref<Record<string, string>>({})

const isDesktop = ref(false)
onMounted(async () => {
  await load()
  isDesktop.value = !!(await desktop())
})

async function browse() {
  const d = await desktop()
  const folder = d ? await d.pick_folder() : ''
  if (folder) newPath.value = folder
}

async function load() {
  if (!app.isLocal) return
  settings.value = await api.settings()
  onlineUrl.value = settings.value.online_url
}

async function savePrefs() {
  if (app.isLocal && settings.value) {
    settings.value = await api.updateSettings({
      display_mode: app.dark ? 'dark' : 'light',
      default_view: app.view,
    })
  }
  app.notify('Saved')
}

async function addLibrary() {
  try {
    await api.createLibrary({ name: newName.value || (newKind.value === 'folder' ? 'OpenSong' : 'My library'), kind: newKind.value, path: newPath.value })
    newName.value = newPath.value = ''
    await load()
    await app.loadLibraries()
    app.notify('Library added')
  } catch (e) {
    app.fail(e)
  }
}

async function updateLib(id: string, data: { name?: string; set_song_path?: string; path?: string }) {
  try {
    await api.updateLibrary(id, data)
    await app.loadLibraries()
  } catch (e) {
    app.fail(e)
  }
}

async function removeLib(id: string) {
  if (!confirm('Remove this library from Redlark? Its files are not deleted.')) return
  await api.deleteLibrary(id)
  await load()
  await app.loadLibraries()
}

async function connect() {
  try {
    await api.syncConnect(onlineUrl.value, onlineEmail.value, onlinePassword.value)
    onlinePassword.value = ''
    await load()
    remoteLibs.value = await api.syncRemoteLibraries()
    app.notify('Connected to your online account')
  } catch (e) {
    app.fail(e)
  }
}

async function loadRemote() {
  try {
    remoteLibs.value = await api.syncRemoteLibraries()
  } catch (e) {
    app.fail(e)
  }
}

async function link(libId: string, remoteId: string) {
  await api.syncLink(libId, remoteId)
  await load()
}

async function previewSync(libId: string) {
  syncing.value = libId
  plan.value = null
  resolutions.value = {}
  try {
    plan.value = await api.syncPreview(libId)
  } catch (e) {
    app.fail(e)
    syncing.value = ''
  }
}

async function applySync() {
  try {
    const res = await api.syncApply(syncing.value, resolutions.value)
    app.notify(`Sync done: ${res.pushed} sent, ${res.pulled} received, ${res.skipped} skipped`)
    plan.value = null
    syncing.value = ''
    await load()
    await app.loadSongs()
  } catch (e) {
    app.fail(e)
  }
}

async function newFromOnline(remote: LibraryInfo) {
  try {
    const lib = await api.createLibrary({ name: remote.name, kind: 'sqlite' })
    await api.syncLink(lib.id, remote.id)
    await api.syncApply(lib.id, {}, 'pull')
    await load()
    await app.loadLibraries()
    app.notify(`Downloaded "${remote.name}" for offline use`)
  } catch (e) {
    app.fail(e)
  }
}

async function openWebsite() {
  const url = settings.value?.online_url
  if (!url) return
  const d = await desktop()
  if (d) await d.open_external(url)
  else window.open(url, '_blank', 'noopener')
}
</script>

<template>
  <div class="form-page">
    <div class="panel">
      <h2>Settings</h2>

      <div class="field">
        <span class="label">Display</span>
        <div class="row">
          <label><input type="radio" :value="false" v-model="app.dark" /> Light</label>
          <label><input type="radio" :value="true" v-model="app.dark" /> Dark</label>
        </div>
      </div>
      <div class="field">
        <span class="label">Default song view</span>
        <div class="row">
          <label><input type="radio" value="chords" v-model="app.view" /> Chords</label>
          <label><input type="radio" value="lyrics" v-model="app.view" /> Lyrics only</label>
        </div>
      </div>
      <div class="row"><button class="btn" @click="savePrefs">Save</button></div>

      <template v-if="app.isLocal && settings">
        <h2 style="margin-top: 24px">Libraries on this computer</h2>
        <table class="data">
          <tr><th>Name</th><th>Location</th><th>Sets song path</th><th>Online</th><th></th></tr>
          <tr v-for="lib in settings.libraries" :key="lib.id">
            <td><input class="text-input" :value="lib.name" @change="updateLib(lib.id, { name: ($event.target as HTMLInputElement).value })" /></td>
            <td>
              <span class="muted">{{ lib.kind === 'folder' ? 'OpenSong folder' : 'Database' }}</span><br />
              <input v-if="lib.kind === 'folder'" class="text-input path" :value="lib.path"
                @change="updateLib(lib.id, { path: ($event.target as HTMLInputElement).value })" />
              <small v-else class="muted">{{ lib.path }}</small>
            </td>
            <td>
              <input v-if="lib.kind === 'folder'" class="text-input" style="width: 6em" :value="lib.set_song_path"
                @change="updateLib(lib.id, { set_song_path: ($event.target as HTMLInputElement).value })" />
            </td>
            <td>
              <template v-if="lib.remote_library_id">
                <button class="btn" @click="previewSync(lib.id)">Sync</button>
                <div class="muted"><small>{{ lib.last_sync ? 'Last: ' + new Date(lib.last_sync).toLocaleString() : 'Never synced' }}</small></div>
              </template>
              <select v-else-if="remoteLibs.length" class="text-input" @change="link(lib.id, ($event.target as HTMLSelectElement).value)">
                <option value="">Link to…</option>
                <option v-for="r in remoteLibs" :key="r.id" :value="r.id">{{ r.name }}</option>
              </select>
            </td>
            <td><button class="btn secondary" @click="removeLib(lib.id)">Remove</button></td>
          </tr>
        </table>

        <div class="field" style="margin-top: 14px">
          <span class="label">Add a library</span>
          <div class="row">
            <select v-model="newKind" class="text-input">
              <option value="folder">OpenSong folder</option>
              <option value="sqlite">New empty library</option>
            </select>
            <input v-model="newName" class="text-input" placeholder="Name" />
            <input v-if="newKind === 'folder'" v-model="newPath" class="text-input path" placeholder="Folder containing Songs and Sets" />
            <button v-if="newKind === 'folder' && isDesktop" class="btn secondary" @click="browse">Browse…</button>
            <button class="btn" @click="addLibrary">Add</button>
          </div>
        </div>

        <h2 style="margin-top: 24px">Sync with an online account</h2>
        <p class="muted">
          <small>Link a library on this computer to one of your online libraries to sync songs and sets both
          ways. Redlark itself always runs from this computer.</small>
        </p>
        <div class="field">
          <div class="row">
            <input v-model="onlineUrl" class="text-input path" placeholder="https://redlark.example.org" />
            <input v-model="onlineEmail" class="text-input" type="email" placeholder="Email" />
            <input v-model="onlinePassword" class="text-input" type="password" placeholder="Password" />
            <button class="btn" @click="connect">Connect</button>
          </div>
          <small v-if="settings.remote_token" class="muted">
            Connected to {{ settings.online_url }} ·
            <a href="#" @click.prevent="loadRemote">show online libraries</a> ·
            <a href="#" @click.prevent="openWebsite">open website in browser</a>
          </small>
        </div>
        <div v-if="remoteLibs.length" class="field">
          <span class="label">Online libraries</span>
          <div v-for="r in remoteLibs" :key="r.id" class="row">
            <span>{{ r.name }} <small class="muted">({{ r.role }})</small></span>
            <button class="btn secondary" @click="newFromOnline(r)">Download for offline use</button>
          </div>
        </div>
        <div v-if="plan" class="sync-plan">
          <h2>Sync preview</h2>
          <p>
            {{ plan.summary.push }} to send · {{ plan.summary.pull }} to receive ·
            {{ plan.summary.conflict }} conflicts · {{ plan.summary.same }} unchanged
          </p>
          <table class="data" v-if="plan.entries.length">
            <tr><th>Item</th><th>Action</th></tr>
            <tr v-for="e in plan.entries" :key="e.key">
              <td>{{ e.kind === 'set' ? 'Set: ' : '' }}{{ e.title }}</td>
              <td>
                <template v-if="e.action === 'conflict'">
                  <select v-model="resolutions[e.key]" class="text-input">
                    <option :value="undefined">Skip (changed on both sides)</option>
                    <option value="local">Keep this computer's version</option>
                    <option value="remote">Keep the online version</option>
                  </select>
                </template>
                <template v-else>{{ e.action === 'push' ? 'Send to online' : 'Get from online' }}</template>
              </td>
            </tr>
          </table>
          <div class="row" style="margin-top: 10px">
            <button class="btn" @click="applySync">Sync now</button>
            <button class="btn secondary" @click="plan = null; syncing = ''">Cancel</button>
          </div>
        </div>
      </template>

      <p class="muted" style="margin-top: 24px"><small>Redlark {{ app.info?.version }}</small></p>
    </div>
  </div>
</template>

<style>
.text-input.path {
  min-width: 260px;
  flex: 1;
}

.sync-plan {
  margin-top: 20px;
  border: 1px solid var(--accent);
  border-radius: 6px;
  padding: 12px;
}

@media (max-width: 700px) {
  table.data,
  table.data tbody,
  table.data tr,
  table.data td {
    display: block;
    width: 100%;
    box-sizing: border-box;
  }
  table.data th {
    display: none;
  }
  table.data tr {
    border-bottom: 2px solid var(--item-border);
    padding: 6px 0;
  }
  .text-input.path {
    min-width: 0;
    width: 100%;
  }
}
</style>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NavHeader from './components/NavHeader.vue'
import { desktop } from './lib/desktop'
import { useAppStore } from './stores/app'

const app = useAppStore()
const route = useRoute()
const router = useRouter()
const ready = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    await app.load()
    if (app.needsLogin && route.name !== 'login') router.replace({ name: 'login', query: { next: route.fullPath } })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    ready.value = true
  }
  // Desktop app: tell the user about new releases.
  const shell = await desktop()
  const update = shell ? await shell.update_info() : null
  if (update) {
    updateVersion.value = update.version
    updateUrl.value = update.url
  }
})

const updateUrl = ref('')
const updateVersion = ref('')

async function openUpdate() {
  const shell = await desktop()
  shell?.open_external(updateUrl.value)
}
</script>

<template>
  <div id="app-root" :class="{ dark: app.dark }">
    <NavHeader v-if="route.name !== 'login'" />
    <div v-if="updateUrl" class="update-banner">
      Redlark {{ updateVersion }} is available.
      <a href="#" @click.prevent="openUpdate">Download</a>
      <button aria-label="Dismiss" @click="updateUrl = ''">×</button>
    </div>
    <main class="page-content">
      <div v-if="!ready" class="loader"></div>
      <div v-else-if="error" class="panel" style="margin: auto">
        <h2>Can't reach Redlark</h2>
        <p class="error-text">{{ error }}</p>
      </div>
      <RouterView v-else />
    </main>
    <div v-if="app.toast" class="toast" :class="{ error: app.toast.error }" @click="app.toast = null">
      {{ app.toast.text }}
    </div>
  </div>
</template>

<style>
.update-banner {
  background: var(--accent);
  color: white;
  padding: 6px 12px;
  display: flex;
  gap: 10px;
  align-items: center;
}
.update-banner a {
  text-decoration: underline;
  font-weight: bold;
}
.update-banner button {
  margin-left: auto;
  background: none;
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
}
</style>

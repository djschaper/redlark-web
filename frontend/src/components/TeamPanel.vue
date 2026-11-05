<script setup lang="ts">
import { ref, watch } from 'vue'
import { api } from '../lib/api'
import { useAppStore } from '../stores/app'

const app = useAppStore()
const members = ref<{ id: string; name: string; email: string; role: string }[]>([])

async function load() {
  members.value = []
  if (app.isLocal || !app.libraryId) return
  try {
    members.value = (await api.members(app.libraryId)) as typeof members.value
  } catch {
    /* not critical */
  }
}

watch(() => [app.libraryId, app.info?.mode], load, { immediate: true })
</script>

<template>
  <div id="team" class="panel">
    <h2>Team</h2>
    <ul class="object-list team-list">
      <template v-if="!app.isLocal">
        <li v-for="m in members" :key="m.id" class="member">
          <span>{{ m.name || m.email }}</span>
          <span class="role">{{ m.role }}</span>
        </li>
      </template>
      <li v-else class="drop-hint">
        {{ app.library?.name }} · {{ app.library?.kind === 'folder' ? 'OpenSong folder' : 'offline library' }}
      </li>
    </ul>
  </div>
</template>

<style>
#team {
  flex: 1;
  min-height: 200px;
  margin: 0 0 5px;
}

.member {
  display: flex;
  justify-content: space-between;
  padding: 4px 6px;
  color: var(--item-text);
  border-bottom: 1px solid var(--item-border);
}

.member .role {
  color: var(--key);
  font-size: small;
  text-transform: capitalize;
}
</style>

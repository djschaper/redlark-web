<script setup lang="ts">
// Songs | Set + Team | Preview. Below 900px the panels become tabs with a bottom bar.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import PreviewPanel from '../components/PreviewPanel.vue'
import SetPanel from '../components/SetPanel.vue'
import SongList from '../components/SongList.vue'
import TeamPanel from '../components/TeamPanel.vue'
import { useSetStore } from '../stores/set'

const props = defineProps<{ openSets?: boolean }>()

type Tab = 'songs' | 'set' | 'preview'
const tab = ref<Tab>(props.openSets ? 'set' : 'songs')
const set = useSetStore()
const router = useRouter()

const narrow = ref(false)
const mq = window.matchMedia('(max-width: 900px)')
const update = () => (narrow.value = mq.matches)
onMounted(() => {
  update()
  mq.addEventListener('change', update)
})
onUnmounted(() => mq.removeEventListener('change', update))

const showPreview = () => {
  if (narrow.value) tab.value = 'preview'
}
const count = computed(() => set.entries.length)
</script>

<template>
  <div class="home" :class="['tab-' + tab]">
    <SongList class="tab-songs-panel" @preview="showPreview" @new-song="router.push({ name: 'new-song' })" />
    <div id="set-team" class="tab-set-panel">
      <SetPanel :show-open="openSets" @preview="showPreview" />
      <TeamPanel />
    </div>
    <PreviewPanel class="tab-preview-panel" />

    <nav class="tab-bar">
      <button :class="{ active: tab === 'songs' }" @click="tab = 'songs'"><Icon name="music" /><span>Songs</span></button>
      <button :class="{ active: tab === 'set' }" @click="tab = 'set'">
        <Icon name="list" /><span>Set</span><b v-if="count" class="badge">{{ count }}</b>
      </button>
      <button :class="{ active: tab === 'preview' }" @click="tab = 'preview'"><Icon name="fileCode" /><span>Preview</span></button>
    </nav>
  </div>
</template>

<style>
.home {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

#set-team {
  width: 300px;
  min-width: 300px;
  display: flex;
  flex-direction: column;
  margin-top: 5px;
  gap: 10px;
}

#set-team #set {
  margin-top: 0;
}

.tab-bar {
  display: none;
}

@media (max-width: 900px) {
  /* One panel at a time; ids beat the panels' own #id rules. */
  .home #songs,
  .home #set-team,
  .home #preview {
    display: none;
  }
  .home.tab-songs #songs,
  .home.tab-preview #preview,
  .home.tab-set #set-team {
    display: flex;
    flex: 1;
    width: auto;
    min-width: 0;
  }
  .home.tab-set #set-team {
    margin: 4px;
  }
  .home.tab-set #team {
    display: none;
  }

  .tab-bar {
    display: flex;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: 56px;
    background: var(--menu-bg);
    z-index: 40;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .tab-bar button {
    flex: 1;
    background: none;
    border: none;
    color: #9fb0c4;
    font-size: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    position: relative;
    cursor: pointer;
  }
  .tab-bar button span {
    font-size: 12px;
    font-weight: bold;
  }
  .tab-bar button.active {
    color: white;
    box-shadow: inset 0 3px 0 var(--accent);
  }
  .badge {
    position: absolute;
    top: 6px;
    left: calc(50% + 8px);
    background: var(--accent);
    color: white;
    font-size: 11px;
    border-radius: 9px;
    padding: 1px 6px;
  }
}
</style>

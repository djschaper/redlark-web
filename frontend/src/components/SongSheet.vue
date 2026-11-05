<script setup lang="ts">
// The one song renderer: live preview, print/PDF and exported HTML all use this component.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { transposeChord, transpositionChange } from '../lib/chords'
import type { Segment, SongPayload, SongSection, ViewMode } from '../lib/types'

const props = withDefaults(
  defineProps<{
    song: SongPayload
    targetKey?: string
    mode?: ViewMode
    columns?: boolean // flow sections into columns (screen); single column for print
  }>(),
  { targetKey: '', mode: 'chords', columns: true },
)

const key = computed(() => props.targetKey || props.song.key)

// Flow sections into as many columns as fit, each as wide as the widest section.
const root = ref<HTMLElement | null>(null)
const cols = ref(1)
const measuring = ref(false)
const GAP = 40
let observer: ResizeObserver | null = null

async function measure() {
  if (!props.columns || !root.value) return
  measuring.value = true
  await nextTick()
  const content = root.value.querySelector('.song-content') as HTMLElement | null
  if (content) {
    const widest = Math.max(1, ...[...content.querySelectorAll<HTMLElement>('.section')].map((el) => el.scrollWidth + (parseFloat(getComputedStyle(el).marginLeft) || 0)))
    cols.value = Math.max(1, Math.min(4, Math.floor((content.clientWidth + GAP) / (widest + GAP))))
  }
  measuring.value = false
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && root.value?.parentElement) {
    observer = new ResizeObserver(() => measure())
    observer.observe(root.value.parentElement)
  }
})
onBeforeUnmount(() => observer?.disconnect())
watch(() => [props.song, props.mode, props.targetKey, props.columns], measure)
const change = computed(() => transpositionChange(props.song.key, key.value))

const sections = computed<SongSection[]>(() =>
  props.mode === 'lyrics' ? props.song.lyrics_sections : props.song.sections,
)

const metaLine = computed(() => {
  const parts: string[] = []
  if (props.song.tempo) parts.push(`Tempo - ${props.song.tempo}`)
  if (props.song.time_sig) parts.push(`Time - ${props.song.time_sig}`)
  return parts.join(' | ')
})

const COMMENT_RE = /(\([^)]+\))/g

function chordText(seg: Segment): string {
  // v1 padding: chords get two trailing spaces, four when they have no lyric under them.
  if (!seg.chord) return ' '
  const chord = change.value ? transposeChord(seg.chord, change.value) : seg.chord
  return seg.lyric ? chord + '  ' : chord + '    '
}

function lyricParts(text: string): { text: string; comment: boolean }[] {
  return text
    .split(COMMENT_RE)
    .filter((t) => t !== '')
    .map((t) => ({ text: t, comment: /^\(.*\)$/.test(t) }))
}

function hasChords(line: { segments: Segment[] }): boolean {
  return line.segments.some((s) => s.chord)
}
</script>

<template>
  <article
    ref="root"
    class="song-sheet"
    :class="{ lyrics: mode === 'lyrics', columns: columns && cols > 1, measuring }"
    :style="{ '--cols': cols }"
  >
    <header class="song-details">
      <div class="song-title-block">
        <h1 class="song-name">{{ song.title }}</h1>
        <div class="song-author">{{ song.author }}</div>
      </div>
      <div v-if="mode === 'chords'" class="key-tempo">
        <div class="song-key" v-if="key">Key - {{ key }}</div>
        <div class="song-tempo">{{ metaLine }}</div>
        <div class="song-tempo" v-if="song.capo">Capo {{ song.capo }}</div>
      </div>
    </header>

    <div class="song-content">
      <section
        v-for="(section, si) in sections"
        :key="si"
        class="section"
        :class="{ indented: section.indented && mode === 'chords' }"
      >
        <div class="section-title" v-if="section.label">{{ section.label }}</div>
        <template v-for="(line, li) in section.lines" :key="li">
          <div v-if="line.kind === 'comment'" class="line comment-line">{{ line.segments[0]?.lyric }}</div>
          <div v-else-if="mode === 'lyrics' || !hasChords(line)" class="line lyric-only">
            <template v-for="(part, pi) in lyricParts(line.segments.map((s) => s.lyric).join(''))" :key="pi">
              <span v-if="part.comment" class="comment">{{ part.text }}</span>
              <template v-else>{{ part.text }}</template>
            </template>
          </div>
          <div v-else class="line">
            <span
              v-for="(seg, gi) in line.segments"
              :key="gi"
              class="chord-lyric"
            ><span class="chord">{{ chordText(seg) }}</span><span class="lyric"><template
                v-for="(part, pi) in lyricParts(seg.lyric)"
                :key="pi"
              ><span v-if="part.comment" class="comment">{{ part.text }}</span><template v-else>{{ part.text }}</template></template></span></span>
          </div>
        </template>
      </section>
    </div>

    <footer class="song-footer" v-if="song.copyright || song.ccli">
      {{ song.copyright }}<template v-if="song.ccli"> | CCLI {{ song.ccli }}</template>
    </footer>
  </article>
</template>

<style>
.song-sheet {
  font-family: Verdana, Arial, Helvetica, sans-serif;
  color: var(--sheet-fg, #000);
  background: var(--sheet-bg, #fff);
  padding: 8px 12px;
  box-sizing: border-box;
}

.song-details {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.song-name {
  font-size: x-large;
  font-weight: bold;
  margin: 0;
}

.song-author,
.song-tempo {
  font-size: small;
}

.key-tempo {
  text-align: right;
  min-width: 170px;
  flex-shrink: 0;
}

.song-key {
  font-size: medium;
  font-weight: bold;
}

.song-content {
  padding-bottom: 10px;
}

/* Screen: sections flow into balanced columns (count computed in measure()). */
.song-sheet.columns .song-content {
  column-count: var(--cols);
  column-gap: 40px;
}

.song-sheet.columns .line,
.song-sheet.measuring .line {
  flex-wrap: nowrap;
}

.song-sheet.measuring .section {
  width: max-content;
}

.section {
  display: block;
  padding-top: 30px;
  break-inside: avoid;
  padding-left: 10px;
}

.section.indented {
  margin-left: 30px;
}

.section-title {
  font-style: italic;
  font-size: small;
}

.line {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
}

.chord-lyric {
  display: inline-flex;
  flex-direction: column;
  white-space: pre;
}

.chord {
  font-weight: bold;
}

/* Keep chords that have no lyric under them on the chord row. */
.lyric:empty::after {
  content: '\00a0';
}

.lyric-only {
  white-space: pre-wrap;
  display: block;
}

.comment,
.comment-line {
  font-style: italic;
  font-size: small;
}

.song-sheet.lyrics .section {
  padding-top: 18px;
}

.song-sheet.lyrics .line {
  font-size: 1.05em;
  line-height: 1.45;
}

.song-footer {
  text-align: center;
  font-size: xx-small;
  margin-top: 16px;
  break-inside: avoid;
}

@media (max-width: 600px) {
  .song-details {
    flex-direction: column;
  }
  .key-tempo {
    text-align: left;
    min-width: 0;
  }
  .section {
    padding-left: 0;
  }
  .section.indented {
    margin-left: 16px;
  }
}

@media print {
  .song-sheet {
    break-after: page;
    padding: 0;
  }
  .song-sheet:last-child {
    break-after: auto;
  }
}
</style>

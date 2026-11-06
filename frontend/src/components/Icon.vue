<script setup lang="ts">
// Inline Font Awesome Free SVGs (CC BY 4.0) — no webfont, so exported HTML stays small.
import print from '@fortawesome/fontawesome-free/svgs/solid/print.svg?raw'
import filePdf from '@fortawesome/fontawesome-free/svgs/solid/file-pdf.svg?raw'
import fileExport from '@fortawesome/fontawesome-free/svgs/solid/file-export.svg?raw'
import moonRegular from '@fortawesome/fontawesome-free/svgs/regular/moon.svg?raw'
import moonSolid from '@fortawesome/fontawesome-free/svgs/solid/moon.svg?raw'
import youtube from '@fortawesome/fontawesome-free/svgs/brands/youtube.svg?raw'
import save from '@fortawesome/fontawesome-free/svgs/solid/floppy-disk.svg?raw'
import folderOpen from '@fortawesome/fontawesome-free/svgs/solid/folder-open.svg?raw'
import fileMedical from '@fortawesome/fontawesome-free/svgs/solid/file-medical.svg?raw'
import copy from '@fortawesome/fontawesome-free/svgs/solid/copy.svg?raw'
import arrowLeft from '@fortawesome/fontawesome-free/svgs/solid/arrow-left.svg?raw'
import circle from '@fortawesome/fontawesome-free/svgs/solid/circle.svg?raw'
import circleMinus from '@fortawesome/fontawesome-free/svgs/solid/circle-minus.svg?raw'
import circleUser from '@fortawesome/fontawesome-free/svgs/solid/circle-user.svg?raw'
import gear from '@fortawesome/fontawesome-free/svgs/solid/gear.svg?raw'
import logout from '@fortawesome/fontawesome-free/svgs/solid/right-from-bracket.svg?raw'
import search from '@fortawesome/fontawesome-free/svgs/solid/magnifying-glass.svg?raw'
import plus from '@fortawesome/fontawesome-free/svgs/solid/plus.svg?raw'
import pen from '@fortawesome/fontawesome-free/svgs/solid/pen.svg?raw'
import music from '@fortawesome/fontawesome-free/svgs/solid/music.svg?raw'
import alignLeft from '@fortawesome/fontawesome-free/svgs/solid/align-left.svg?raw'
import grip from '@fortawesome/fontawesome-free/svgs/solid/grip-vertical.svg?raw'
import download from '@fortawesome/fontawesome-free/svgs/solid/download.svg?raw'
import upload from '@fortawesome/fontawesome-free/svgs/solid/upload.svg?raw'
import list from '@fortawesome/fontawesome-free/svgs/solid/list.svg?raw'
import xmark from '@fortawesome/fontawesome-free/svgs/solid/xmark.svg?raw'
import rotate from '@fortawesome/fontawesome-free/svgs/solid/rotate.svg?raw'
import bars from '@fortawesome/fontawesome-free/svgs/solid/bars.svg?raw'
import users from '@fortawesome/fontawesome-free/svgs/solid/users.svg?raw'
import trash from '@fortawesome/fontawesome-free/svgs/solid/trash.svg?raw'
import fileCode from '@fortawesome/fontawesome-free/svgs/solid/file-code.svg?raw'
import expand from '@fortawesome/fontawesome-free/svgs/solid/expand.svg?raw'
import compress from '@fortawesome/fontawesome-free/svgs/solid/compress.svg?raw'
import { computed } from 'vue'

const ICONS = {
  print, filePdf, fileExport, moonRegular, moonSolid, youtube, save, folderOpen, fileMedical, copy, arrowLeft,
  circle, circleMinus, circleUser, gear, logout, search, plus, pen, music, alignLeft, grip, download, upload,
  list, xmark, rotate, bars, users, trash, fileCode, expand, compress,
} as const

export type IconName = keyof typeof ICONS

const props = defineProps<{ name: IconName }>()
const svg = computed(() => ICONS[props.name].replace(/<!--.*?-->/s, ''))
</script>

<template>
  <span class="icon" aria-hidden="true" v-html="svg"></span>
</template>

<style>
.icon {
  display: inline-flex;
  width: 1em;
  height: 1em;
  vertical-align: -0.125em;
}
.icon svg {
  width: 100%;
  height: 100%;
}
</style>

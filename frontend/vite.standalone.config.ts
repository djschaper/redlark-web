import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Self-contained song viewer used for HTML export and PDF rendering.
// Produces backend/redlark/static/standalone.html with every asset inlined.
export default defineConfig({
  root: resolve(__dirname, 'standalone'),
  plugins: [vue(), viteSingleFile()],
  build: {
    outDir: resolve(__dirname, '../backend/redlark/static'),
    emptyOutDir: false,
    rollupOptions: { input: resolve(__dirname, 'standalone/standalone.html') },
  },
})

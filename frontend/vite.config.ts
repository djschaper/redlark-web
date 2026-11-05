/// <reference types="vitest/config" />
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// Main single-page app. Built into the Python package so FastAPI serves it.
export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: '../backend/redlark/static',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
  test: {
    environment: 'node',
  },
})

import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

const stylesDir = fileURLToPath(new URL('./src/styles', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Every SCSS file (global + CSS modules) gets breakpoints, mixins and functions.
        loadPaths: [stylesDir],
        additionalData: `@use "abstracts" as *;\n`,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-markdown') || id.includes('node_modules/remark') || id.includes('node_modules/micromark') || id.includes('node_modules/mdast')) return 'markdown'
          if (id.includes('node_modules/jszip') || id.includes('node_modules/file-saver')) return 'export'
          if (id.includes('node_modules/react')) return 'react'
        },
      },
    },
  },
})

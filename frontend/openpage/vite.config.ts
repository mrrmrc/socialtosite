import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  base: '/builder/',
  plugins: [react(), tailwindcss()],
  // The dashboard and builder share application tokens and the brand asset.
  server: { fs: { allow: [path.resolve(__dirname, '..')] } },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // Publication embeds Vite's compiled CSS; test the real stylesheet too.
    css: { include: /index\.css/ },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/openpage'),
    },
  },
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' }))
  },
  server: {
    port: 5173,
    host: true,
  }
})

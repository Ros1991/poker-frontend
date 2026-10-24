import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Login com Google em http://localhost (SPEC-20261023-1210): o Google Identity Services pede este
    // Referrer-Policy fora de https. Só no servidor de desenvolvimento.
    headers: {
      'Referrer-Policy': 'no-referrer-when-downgrade',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5172',
        changeOrigin: true,
      },
      '/hubs': {
        target: 'http://localhost:5172',
        changeOrigin: true,
        ws: true,
      },
      '/uploads': {
        target: 'http://localhost:5172',
        changeOrigin: true,
      },
    },
  },
})

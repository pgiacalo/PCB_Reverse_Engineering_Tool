import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/PCB_Reverse_Engineering_Tool/',
  server: {
    port: 5173,
    strictPort: false, // If port is in use, try next available port
  },
})

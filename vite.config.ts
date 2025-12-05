import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        // Disable compact mode warning for large files (App.tsx is ~560KB)
        // This prevents the "[BABEL] Note: The code generator has deoptimised the styling..." warning
        compact: false,
      },
    }),
  ],
  base: '/PCB_Reverse_Engineering_Tool/',
  server: {
    port: 5173,
    strictPort: false, // If port is in use, try next available port
  },
  build: {
    // Suppress the chunk size warning for our main bundle
    chunkSizeWarningLimit: 700, // in kB
  },
})

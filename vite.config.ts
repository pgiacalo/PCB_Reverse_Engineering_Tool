import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import obfuscatorPlugin from 'vite-plugin-javascript-obfuscator'

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
    // Code obfuscation for production builds only
    obfuscatorPlugin({
      options: {
        // Performance-friendly obfuscation settings
        compact: true,
        controlFlowFlattening: false, // Disabled for better performance
        deadCodeInjection: false, // Disabled for better performance
        debugProtection: false, // Disabled to avoid breaking DevTools
        debugProtectionInterval: 0,
        disableConsoleOutput: false, // Keep console for debugging
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        numbersToExpressions: false, // Disabled for better performance
        renameGlobals: false, // Disabled to avoid breaking React
        selfDefending: false, // Disabled for better performance
        simplify: true,
        splitStrings: false, // Disabled for better performance
        stringArray: true,
        stringArrayCallsTransform: false, // Disabled for better performance
        stringArrayEncoding: ['base64'], // Light encoding
        stringArrayIndexShift: true,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayWrappersCount: 1, // Minimal wrappers for performance
        stringArrayWrappersChainedCalls: false, // Disabled for better performance
        stringArrayWrappersParametersMaxCount: 2,
        stringArrayWrappersType: 'variable',
        stringArrayThreshold: 0.75,
        transformObjectKeys: false, // Disabled to avoid breaking React
        unicodeEscapeSequence: false, // Disabled for better performance
      },
      // Only obfuscate in production builds
      apply: 'build',
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
    // Disable source maps for security and performance
    sourcemap: false,
    // Enable minification (esbuild is faster than terser and is the default)
    minify: 'esbuild',
  },
})

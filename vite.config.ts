/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  build: {
    rollupOptions: {
      output: {
        // React and framer-motion change far less often than the app: in their own chunks, a
        // release leaves them cached in the browser instead of re-shipping them inside index.js.
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react'
          if (/[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'motion'
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  server: {
    proxy: {
      '/metadata': 'http://localhost:8080',
      '/starter.zip': 'http://localhost:8080',
      '/starter.preview': 'http://localhost:8080',
      '/starter-multimodule.zip': 'http://localhost:8080',
      '/starter-multimodule.preview': 'http://localhost:8080',
      '/starter-wizard.zip': 'http://localhost:8080',
      '/starter-wizard.preview': 'http://localhost:8080',
      '/starter-wizard.detect-paths': 'http://localhost:8080',
      '/starter-wizard.detect-services': 'http://localhost:8080',
      '/actuator': 'http://localhost:8080',
      '/admin': 'http://localhost:8080',
      // The design preview runtime (sandboxed iframe), served by the backend with its own CSP.
      '/design-runtime': 'http://localhost:8080',
      '/frontend': 'http://localhost:8080',
      '/starter-fullstack.zip': 'http://localhost:8080',
      '/starter-fullstack.preview': 'http://localhost:8080'
    }
  }
})

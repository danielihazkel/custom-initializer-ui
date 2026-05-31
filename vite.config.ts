/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
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
      '/frontend': 'http://localhost:8080',
      '/starter-fullstack.zip': 'http://localhost:8080',
      '/starter-fullstack.preview': 'http://localhost:8080'
    }
  }
})

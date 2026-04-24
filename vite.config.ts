import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
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
      '/actuator': 'http://localhost:8080',
      '/admin': 'http://localhost:8080',
    }
  }
})

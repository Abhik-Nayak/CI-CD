import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dev-only gateway: mirrors what nginx does in Docker.
  // Without Docker there is no nginx, so Vite proxies each path prefix
  // to the right microservice running natively on the host.
  server: {
    proxy: {
      '/api/auth': {
        target: 'http://localhost:5002',  // auth-service
        changeOrigin: true,
      },
      '/api/todos': {
        target: 'http://localhost:5001',  // todo-service
        changeOrigin: true,
      },
    },
  },
})

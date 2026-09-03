import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development Vite (5173) and the backend (4000) run on separate ports, but
// the frontend calls the API with relative paths (/api/...). This proxy
// forwards those to the backend, so the code behaves identically to the
// single-port production setup — no CORS or URL differences to account for.
const API_TARGET = process.env.VITE_PROXY_TARGET || 'http://localhost:4000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  // react-simple-maps v3 ships CommonJS; these two entries let Vite
  // pre-bundle it cleanly in dev and in the production build.
  optimizeDeps: {
    include: ['react-simple-maps', 'prop-types'],
  },
  build: {
    commonjsOptions: {
      include: [/react-simple-maps/, /prop-types/, /node_modules/],
    },
  },
})

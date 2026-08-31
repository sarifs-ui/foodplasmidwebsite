import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      'react-simple-maps',
      'prop-types',
    ],
  },
  build: {
    commonjsOptions: {
      include: [/react-simple-maps/, /prop-types/, /node_modules/],
    },
  },
})
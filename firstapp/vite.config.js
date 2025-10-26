import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    headers: {
      // Use credentialless for better compatibility with third-party resources (e.g., Daum Postcode API)
      // while still enabling SharedArrayBuffer for FFmpeg.wasm
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  }
})

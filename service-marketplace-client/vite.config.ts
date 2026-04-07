import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Explicitly pin HMR to the same host and port so Vite doesn't try to
    // auto-detect the WebSocket parameters — auto-detection fails on some
    // macOS network stacks, VPNs, or when browser extensions interfere with
    // WebSocket upgrades on localhost.
    hmr: {
      protocol: 'ws',
      host:     'localhost',
      port:     5173,
    },
  },
})


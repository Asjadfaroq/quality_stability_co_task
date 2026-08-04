import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Fail loudly if 5173 is taken instead of silently moving to 5174. A shifted port
    // breaks two things at once: the API's CORS allow-list only contains 5173/3000, and
    // the HMR websocket URL no longer matches the page origin. Erroring out surfaces the
    // stale dev server immediately rather than as confusing CORS/websocket failures.
    strictPort: true,
    // HMR is intentionally left unconfigured: Vite derives the websocket protocol, host
    // and port from the page's own origin, which is correct by construction. Pinning them
    // to a literal port desynchronises HMR from the server whenever the port changes.
  },
})


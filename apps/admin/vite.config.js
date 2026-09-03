import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const API_TARGET = process.env.VITE_API_URL || "http://localhost:8000"

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 5174,
    strictPort: true,
    // See the portal config: Vite's default ([::1]) refuses IPv4, which breaks
    // VS Code port forwarding and access from any other machine.
    host: true,

    // Let a tunnel hostname through Vite's DNS-rebinding guard.
    allowedHosts: [".trycloudflare.com", ".devtunnels.ms", ".ngrok-free.app", ".ngrok.io"],
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true
      }
    }
  },

  // See the portal config: serve the built bundle when sharing over a tunnel,
  // because the dev server's per-module requests do not survive one.
  preview: {
    port: 5174,
    strictPort: true,
    host: true,
    allowedHosts: [".trycloudflare.com", ".devtunnels.ms", ".ngrok-free.app", ".ngrok.io"],
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true
      }
    }
  }
})

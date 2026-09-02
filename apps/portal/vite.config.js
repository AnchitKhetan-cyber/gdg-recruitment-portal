import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const API_TARGET = process.env.VITE_API_URL || "http://localhost:8000"

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 5173,
    strictPort: true,
    // Proxying keeps the API on the portal's own origin during development, so
    // session cookies behave exactly as they will in production.
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true
      }
    }
  },

  preview: { port: 5173 },

  build: {
    // Firebase is a third of the bundle and changes rarely - split it so a
    // candidate on a slow connection caches it across deploys.
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth"],
          motion: ["framer-motion"]
        }
      }
    }
  }
})

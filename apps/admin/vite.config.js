import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const API_TARGET = process.env.VITE_API_URL || "http://localhost:8000"

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true
      }
    }
  },

  preview: { port: 5174 }
})

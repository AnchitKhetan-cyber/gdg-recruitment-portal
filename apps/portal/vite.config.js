import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const API_TARGET = process.env.VITE_API_URL || "http://localhost:8000"

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 5173,
    strictPort: true,
    // Bind every interface, not just IPv6 loopback. Vite's default ([::1])
    // refuses IPv4 connections, which breaks VS Code port forwarding and any
    // access from another machine - both connect over 127.0.0.1 / the LAN IP.
    host: true,

    // Vite rejects requests whose Host header it does not recognise, as
    // protection against DNS rebinding. localhost and bare IPs are allowed
    // already; these entries let a tunnel serve the dev site. A leading dot
    // matches the domain and its subdomains, which is what quick tunnels need
    // since they mint a new hostname on every restart.
    allowedHosts: [".trycloudflare.com", ".devtunnels.ms", ".ngrok-free.app", ".ngrok.io"],
    // Proxying keeps the API on the portal's own origin during development, so
    // session cookies behave exactly as they will in production.
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true
      }
    }
  },

  /**
   * `vite preview` serves the built bundle - a handful of files rather than the
   * hundreds of individual ES modules the dev server emits. That difference
   * matters over a tunnel, where the module storm reliably trips
   * ERR_HTTP2_PROTOCOL_ERROR and leaves a blank page. Use this, not `dev`, when
   * sharing the site with another machine.
   */
  preview: {
    port: 5173,
    strictPort: true,
    host: true,
    allowedHosts: [".trycloudflare.com", ".devtunnels.ms", ".ngrok-free.app", ".ngrok.io"],
    // The built app calls /api relative to its own origin, so preview proxies
    // it onward exactly as the dev server does.
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true
      }
    }
  },

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

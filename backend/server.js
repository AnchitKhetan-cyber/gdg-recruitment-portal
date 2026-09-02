import { createApp } from "./app.js"
import { assertEnv, env } from "./config/env.js"
import { connectDataBase, disconnectDataBase } from "./config/db.js"

const start = async () => {
  assertEnv()

  // Connect before listening so the first request never races the database.
  await connectDataBase()

  const app = createApp()

  const server = app.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port} (${env.nodeEnv})`)
    console.log(`[server] CORS origins: ${env.corsOrigins.join(", ")}`)
  })

  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received, shutting down`)
    server.close(async () => {
      await disconnectDataBase()
      process.exit(0)
    })
    // Don't hang forever on a stuck connection.
    setTimeout(() => process.exit(1), 10_000).unref()
  }

  process.on("SIGINT", () => shutdown("SIGINT"))
  process.on("SIGTERM", () => shutdown("SIGTERM"))
}

start().catch((error) => {
  console.error("[server] failed to start:", error.message)
  process.exit(1)
})

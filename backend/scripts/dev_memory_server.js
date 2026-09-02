/**
 * Runs the API against a throwaway in-memory MongoDB.
 *
 *   npm run dev:mem
 *
 * Nothing needs to be installed and nothing is persisted - the database is
 * created fresh, seeded, and discarded when the process exits. Use this to demo
 * the portal on a machine with no MongoDB, then switch to `npm run dev` once a
 * real local server is running.
 */
import { MongoMemoryServer } from "mongodb-memory-server"
import { createApp } from "../app.js"
import { assertEnv, env } from "../config/env.js"
import { connectDataBase, disconnectDataBase } from "../config/db.js"
import { seed } from "./seed.js"

const start = async () => {
  assertEnv()

  console.log("[dev:mem] starting in-memory MongoDB (first run downloads a binary)...")
  const mongo = await MongoMemoryServer.create({ instance: { dbName: "gdg_recruitment" } })
  const uri = mongo.getUri()

  await connectDataBase(uri)
  await seed({ reset: true })

  const app = createApp()
  const server = app.listen(env.port, () => {
    console.log(`[dev:mem] API on http://localhost:${env.port}`)
    console.log("[dev:mem] data is in memory only and will be lost on exit")
  })

  const shutdown = async () => {
    server.close()
    await disconnectDataBase().catch(() => {})
    await mongo.stop()
    process.exit(0)
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

start().catch((error) => {
  console.error("[dev:mem] failed:", error)
  process.exit(1)
})

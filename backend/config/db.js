import mongoose from "mongoose"
import { env } from "./env.js"

mongoose.set("strictQuery", true)

export const connectDataBase = async (uri = env.mongoUri) => {
  if (!uri) {
    throw new Error("MONGO_URI is not set")
  }

  mongoose.connection.on("disconnected", () => {
    console.warn("[db] disconnected from MongoDB")
  })

  mongoose.connection.on("error", (error) => {
    console.error("[db] connection error:", error.message)
  })

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    // Cap concurrent connections so a burst of autosaves queues briefly instead
    // of opening unbounded sockets and overwhelming the database. Tune via
    // DB_MAX_POOL for a bigger deployment.
    maxPoolSize: Number.parseInt(process.env.DB_MAX_POOL, 10) || 50,
    minPoolSize: 5,
    socketTimeoutMS: 45_000
  })

  const { host, port, name } = mongoose.connection
  console.log(`[db] connected to mongodb://${host}:${port}/${name}`)

  return mongoose.connection
}

export const disconnectDataBase = async () => {
  await mongoose.connection.close()
}

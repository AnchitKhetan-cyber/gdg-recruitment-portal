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
    serverSelectionTimeoutMS: 10_000
  })

  const { host, port, name } = mongoose.connection
  console.log(`[db] connected to mongodb://${host}:${port}/${name}`)

  return mongoose.connection
}

export const disconnectDataBase = async () => {
  await mongoose.connection.close()
}

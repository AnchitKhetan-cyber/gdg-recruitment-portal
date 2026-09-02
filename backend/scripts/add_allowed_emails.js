/**
 * Imports a candidate whitelist from a CSV file.
 *
 *   npm run seed:allowed -- ./scripts/sample.csv
 *
 * Expected header: name,email,phone[,tag]
 * Existing emails are skipped, so re-running the same file is safe.
 */
import fs from "node:fs/promises"
import path from "node:path"
import { parse } from "csv-parse/sync"
import { connectDataBase, disconnectDataBase } from "../config/db.js"
import { Allowed, EMAIL_REGEX, PHONE_REGEX } from "../models/allowed.model.js"

const file = process.argv[2] || "./scripts/sample.csv"

const run = async () => {
  const absolute = path.resolve(process.cwd(), file)
  const raw = await fs.readFile(absolute, "utf8")

  const rows = parse(raw, {
    columns: (header) => header.map((h) => h.trim().toLowerCase()),
    skip_empty_lines: true,
    trim: true
  })

  const valid = []
  const rejected = []

  rows.forEach((row, index) => {
    const entry = {
      name: row.name || "",
      email: (row.email || "").toLowerCase(),
      phone: (row.phone || "").replace(/\D/g, ""),
      tag: row.tag || ""
    }

    if (!EMAIL_REGEX.test(entry.email)) {
      rejected.push({ line: index + 2, reason: `invalid email "${entry.email}"` })
      return
    }
    if (!PHONE_REGEX.test(entry.phone)) {
      rejected.push({ line: index + 2, reason: `invalid phone "${entry.phone}"` })
      return
    }
    if (entry.name.length < 2) {
      rejected.push({ line: index + 2, reason: "name too short" })
      return
    }

    valid.push(entry)
  })

  if (!valid.length) {
    console.error("[allowed] nothing to import")
    rejected.forEach((r) => console.error(`  line ${r.line}: ${r.reason}`))
    return
  }

  await connectDataBase()

  const result = await Allowed.bulkWrite(
    valid.map((entry) => ({
      updateOne: {
        filter: { email: entry.email },
        update: { $setOnInsert: entry },
        upsert: true
      }
    })),
    { ordered: false }
  )

  console.log(`[allowed] parsed ${rows.length} row(s) from ${path.basename(absolute)}`)
  console.log(`[allowed] inserted ${result.upsertedCount || 0}, skipped ${valid.length - (result.upsertedCount || 0)} duplicate(s)`)

  if (rejected.length) {
    console.warn(`[allowed] rejected ${rejected.length} row(s):`)
    rejected.forEach((r) => console.warn(`  line ${r.line}: ${r.reason}`))
  }

  console.log(`[allowed] whitelist now holds ${await Allowed.countDocuments()} candidate(s)`)
  await disconnectDataBase()
}

run().catch((error) => {
  console.error("[allowed] failed:", error.message)
  process.exit(1)
})

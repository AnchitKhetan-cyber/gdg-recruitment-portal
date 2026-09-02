/**
 * Installs a Firebase service-account key into backend/.env.
 *
 *   npm run install:sa -- "C:\path\to\service-account.json"
 *
 * Run this yourself rather than pasting a key into a chat, an issue, or a
 * commit: the private key it contains grants full admin access to the Firebase
 * project, and anything it is pasted into keeps a copy.
 *
 * The key is written as a single-line JSON value, which avoids the newline
 * escaping that makes the split FIREBASE_PRIVATE_KEY form so error-prone.
 * Nothing secret is printed - only the project and the client email.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const REQUIRED = ["type", "project_id", "private_key", "client_email"]

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const envPath = path.join(backendRoot, ".env")

const keyPath = process.argv[2]

if (!keyPath) {
  console.error('Usage: npm run install:sa -- "C:\\path\\to\\service-account.json"')
  process.exit(1)
}

const resolved = path.resolve(process.cwd(), keyPath)

if (!fs.existsSync(resolved)) {
  console.error(`[sa] no such file: ${resolved}`)
  process.exit(1)
}

let serviceAccount
try {
  serviceAccount = JSON.parse(fs.readFileSync(resolved, "utf8"))
} catch (error) {
  console.error(`[sa] ${path.basename(resolved)} is not valid JSON: ${error.message}`)
  process.exit(1)
}

const missing = REQUIRED.filter((field) => !serviceAccount[field])
if (missing.length) {
  console.error(`[sa] not a service-account key - missing: ${missing.join(", ")}`)
  console.error("[sa] download it from Project settings > Service accounts > Generate new private key")
  process.exit(1)
}

if (serviceAccount.type !== "service_account") {
  console.error(`[sa] expected type "service_account", got "${serviceAccount.type}"`)
  process.exit(1)
}

if (!serviceAccount.private_key.includes("BEGIN PRIVATE KEY")) {
  console.error("[sa] private_key does not look like a PEM key")
  process.exit(1)
}

if (!fs.existsSync(envPath)) {
  console.error("[sa] backend/.env not found - copy .env.example to .env first")
  process.exit(1)
}

const previous = fs.readFileSync(envPath, "utf8")

// Drop any existing Firebase config and the dev bypass, then re-add both.
const kept = previous
  .split(/\r?\n/)
  .filter((line) => !/^FIREBASE_/.test(line) && !/^AUTH_ALLOW_INSECURE_DEV_LOGIN=/.test(line))
  .join("\n")
  .replace(/\n{3,}$/, "\n")
  .replace(/\n+$/, "")

const next = [
  kept,
  "",
  "# Firebase Admin - verifies the Google ID tokens candidates sign in with.",
  `FIREBASE_SERVICE_ACCOUNT_KEY=${JSON.stringify(serviceAccount)}`,
  "",
  "# Real verification is configured, so the dev bypass must stay off.",
  "AUTH_ALLOW_INSECURE_DEV_LOGIN=false",
  ""
].join("\n")

// Keep one backup so a bad install can be undone.
fs.writeFileSync(`${envPath}.bak`, previous)
fs.writeFileSync(envPath, next)

const hadPrevious = /FIREBASE_/.test(previous)

console.log(`[sa] ${hadPrevious ? "replaced" : "installed"} credentials in backend/.env`)
console.log(`[sa]   project      ${serviceAccount.project_id}`)
console.log(`[sa]   client email ${serviceAccount.client_email}`)
console.log(`[sa]   key id       ${serviceAccount.private_key_id || "(not present)"}`)
console.log(`[sa]   private key  present, not printed`)
console.log("[sa] previous .env saved as .env.bak")
console.log("")
console.log("Next:")
console.log("  1. restart the API")
console.log("  2. npm run verify:firebase   (confirms the key works)")
console.log("  3. delete the downloaded .json, and revoke the old key in the console")

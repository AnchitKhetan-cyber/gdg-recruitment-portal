/**
 * Prints a bcrypt hash for ADMIN_PASSWORD_HASH.
 *
 *   npm run hash-admin-password -- "my super secret password"
 */
import bcrypt from "bcryptjs"

const password = process.argv[2]

if (!password) {
  console.error('Usage: npm run hash-admin-password -- "your password"')
  process.exit(1)
}

if (password.length < 12) {
  console.warn("[warn] use at least 12 characters for an admin password")
}

const hash = await bcrypt.hash(password, 12)

console.log("\nAdd this to backend/.env:\n")
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`)
console.log("Then remove the plaintext ADMIN_PASSWORD line.\n")

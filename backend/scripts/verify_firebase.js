/**
 * Checks that the configured Firebase credentials actually work.
 *
 *   npm run verify:firebase
 *
 * Being present in .env and being valid are different things, and the usual
 * failure - a mangled private key - only shows up when a candidate tries to
 * sign in. This proves the key end to end before a drive starts:
 *   1. firebase-admin initialises
 *   2. Google issues an access token for the service account
 *   3. the Auth API is reachable
 *   4. a forged, unsigned token is rejected
 */
import "../config/env.js"
import { env } from "../config/env.js"
import { getFirebaseAdmin, verifyFirebaseToken } from "../config/firebase.js"

let failed = false

const pass = (message) => console.log(`  PASS  ${message}`)
const fail = (message) => {
  failed = true
  console.log(`  FAIL  ${message}`)
}
const warn = (message) => console.log(`  WARN  ${message}`)

console.log("\nFirebase credential check\n")

if (env.allowInsecureDevLogin) {
  warn("AUTH_ALLOW_INSECURE_DEV_LOGIN is true - unsigned tokens are accepted.")
  warn("Fine locally, but set it to false once real credentials are in place.")
}

const admin = getFirebaseAdmin()

if (!admin) {
  fail("firebase-admin did not initialise - no service account configured")
  console.log("\n  Run: npm run install:sa -- \"path/to/service-account.json\"\n")
  process.exit(1)
}

pass("firebase-admin initialised")

try {
  const token = await admin.app().options.credential.getAccessToken()
  pass(`Google issued an access token (expires in ${token.expires_in}s)`)
} catch (error) {
  fail(`Google rejected the service account: ${error.message}`)
  console.log("\n  The private key is usually the culprit. Reinstall with:")
  console.log('  npm run install:sa -- "path/to/service-account.json"\n')
  process.exit(1)
}

try {
  await admin.auth().listUsers(1)
  pass("Firebase Auth API is reachable")
} catch (error) {
  fail(`could not reach the Auth API: ${error.message}`)
}

// A hand-crafted unsigned token, exactly what an attacker would send.
const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url")
const forged = [
  encode({ alg: "none", typ: "JWT" }),
  encode({ user_id: "forged", sub: "forged", email: "attacker@example.com", email_verified: true }),
  "not-a-signature"
].join(".")

try {
  await verifyFirebaseToken(forged)
  fail("a forged token was ACCEPTED - candidate sign-in can be bypassed")
} catch {
  pass("forged tokens are rejected")
}

console.log(
  failed
    ? "\nOne or more checks failed.\n"
    : "\nAll checks passed - candidate sign-in is properly verified.\n"
)

process.exit(failed ? 1 : 0)

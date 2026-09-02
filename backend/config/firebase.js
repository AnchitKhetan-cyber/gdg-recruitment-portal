import admin from "firebase-admin"
import { env } from "./env.js"

let cachedApp = null

const buildServiceAccount = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  }

  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
    return null
  }

  return {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(
      process.env.FIREBASE_CLIENT_EMAIL || ""
    )}`
  }
}

/**
 * Lazily initialises firebase-admin. Returns null when credentials are absent so
 * the API can still boot (and serve the admin panel) on a machine that has no
 * Firebase service account configured.
 */
export const getFirebaseAdmin = () => {
  if (cachedApp) return cachedApp
  if (admin.apps.length) {
    cachedApp = admin
    return cachedApp
  }

  const serviceAccount = buildServiceAccount()
  if (!serviceAccount) {
    console.warn(
      "[firebase] no service account configured - Google sign-in will be rejected"
    )
    return null
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  })

  cachedApp = admin
  return cachedApp
}

const decodeUnverified = (idToken) => {
  const [, payload] = idToken.split(".")
  if (!payload) throw new Error("Malformed token")
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
}

/**
 * Verifies a Firebase ID token and returns the normalised identity.
 * Throws on any failure - callers translate that into a 401.
 */
export const verifyFirebaseToken = async (idToken) => {
  const firebase = getFirebaseAdmin()

  if (!firebase) {
    if (env.allowInsecureDevLogin && !env.isProduction) {
      console.warn("[firebase] DEV MODE - accepting an unverified ID token")
      const claims = decodeUnverified(idToken)
      return {
        uid: claims.user_id || claims.sub,
        email: claims.email,
        name: claims.name,
        emailVerified: Boolean(claims.email_verified)
      }
    }
    throw new Error("Firebase authentication is not configured on this server")
  }

  const decoded = await firebase.auth().verifyIdToken(idToken, true)

  return {
    uid: decoded.uid,
    email: decoded.email,
    name: decoded.name,
    emailVerified: Boolean(decoded.email_verified)
  }
}

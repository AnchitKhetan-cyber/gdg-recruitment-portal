import { initializeApp } from "firebase/app"
import { GoogleAuthProvider, getAuth, signInWithPopup, signOut } from "firebase/auth"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

/** True only when the web config has actually been filled in. */
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null

export const auth = app ? getAuth(app) : null

const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: "select_account" })

/**
 * Opens the Google popup and returns a fresh ID token for the backend to verify.
 * Popup-specific failures are translated into messages a candidate can act on.
 */
export const signInWithGoogle = async () => {
  if (!auth) {
    throw new Error("Google sign-in is not configured. Contact the organisers.")
  }

  try {
    const result = await signInWithPopup(auth, provider)
    const idToken = await result.user.getIdToken()

    if (!result.user.email) {
      throw new Error("Your Google account did not share an email address")
    }

    return { idToken, email: result.user.email }
  } catch (error) {
    if (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request") {
      throw new Error("Sign-in was cancelled")
    }
    if (error.code === "auth/popup-blocked") {
      throw new Error("Your browser blocked the sign-in popup. Allow popups and try again.")
    }
    if (error.code === "auth/network-request-failed") {
      throw new Error("Network error during sign-in. Check your connection.")
    }
    throw error
  }
}

export const signOutFromGoogle = async () => {
  if (auth) await signOut(auth).catch(() => {})
}

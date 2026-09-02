/**
 * DEV ONLY - drives fake candidate attempts through the real HTTP API so the
 * admin panel can be demoed with realistic data.
 *
 *   npm run demo -- --count 25
 *
 * Requires the server to be running with AUTH_ALLOW_INSECURE_DEV_LOGIN=true.
 * Nothing here is imported by the application; it only speaks HTTP.
 */
const API = process.env.DEMO_API || "http://localhost:8000"
const countArg = process.argv.indexOf("--count")
const COUNT = countArg > -1 ? Number.parseInt(process.argv[countArg + 1], 10) || 20 : 20

const FIRST = [
  "Aarav", "Diya", "Kabir", "Ishita", "Rohan", "Meera", "Arjun", "Ananya", "Vihaan", "Saanvi",
  "Aditya", "Riya", "Krishna", "Aisha", "Dev", "Tara", "Nikhil", "Zara", "Yash", "Neha",
  "Kiran", "Pooja", "Rahul", "Sneha", "Manav"
]
const LAST = [
  "Sharma", "Verma", "Nair", "Rao", "Gupta", "Iyer", "Das", "Menon", "Reddy", "Bose",
  "Kapoor", "Joshi", "Patel", "Singh", "Khanna"
]

/** Builds an unsigned JWT-shaped token for the dev-login path. */
const devToken = (uid, email, name) => {
  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url")
  const payload = { user_id: uid, sub: uid, email, name, email_verified: true }
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.dev`
}

const makeClient = () => {
  const jar = new Map()

  return async (path, { method = "GET", body, headers = {} } = {}) => {
    const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ")

    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    })

    for (const raw of response.headers.getSetCookie?.() || []) {
      const [pair] = raw.split(";")
      const index = pair.indexOf("=")
      jar.set(pair.slice(0, index), pair.slice(index + 1))
    }

    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }

    return { status: response.status, data }
  }
}

const pick = (list) => list[Math.floor(Math.random() * list.length)]

const run = async () => {
  const health = await fetch(`${API}/api/health`).catch(() => null)
  if (!health?.ok) {
    console.error(`[demo] cannot reach the API at ${API}. Start it first (npm run dev:mem).`)
    process.exit(1)
  }

  // Whitelist the demo candidates through the admin API.
  const admin = makeClient()
  const login = await admin("/api/admin/login", {
    method: "POST",
    body: { password: process.env.ADMIN_PASSWORD || "gdg-admin-dev" }
  })

  if (login.status !== 200) {
    console.error("[demo] admin login failed - set ADMIN_PASSWORD to match your .env")
    process.exit(1)
  }

  const people = Array.from({ length: COUNT }, (_, index) => {
    const name = `${pick(FIRST)} ${pick(LAST)}`
    return {
      name,
      email: `demo${index + 1}.${name.split(" ")[0].toLowerCase()}@example.com`,
      phone: String(9100000000 + index),
      tag: pick(["2026", "2027", "2028"])
    }
  })

  const bulk = await admin("/api/admin/allowed-users/bulk", {
    method: "POST",
    body: { entries: people }
  })
  console.log(`[demo] whitelisted ${bulk.data.inserted} candidate(s)`)

  let submitted = 0
  let started = 0
  let flagged = 0

  // The sign-in limiter allows 20 requests a minute from one IP, so pace the
  // run rather than tripping it and losing half the cohort.
  const pace = () => new Promise((resolve) => setTimeout(resolve, 3200))

  for (const [index, person] of people.entries()) {
    if (index > 0) await pace()

    const client = makeClient()

    const auth = await client("/api/user/firebase-auth", {
      method: "POST",
      body: {},
      headers: { Authorization: `Bearer ${devToken(`demo-uid-${index}`, person.email, person.name)}` }
    })

    if (auth.status !== 200) {
      console.error(`[demo] sign-in failed for ${person.email}: ${auth.data.message}`)
      continue
    }

    // A fifth of the cohort never opens the paper.
    if (Math.random() < 0.2) continue

    const start = await client("/api/user/start-quiz", { method: "POST", body: {} })
    if (start.status !== 200) continue
    started += 1

    const questions = start.data.quiz.questions

    // A tenth leave an attempt open, so "in progress" is populated.
    if (Math.random() < 0.12) {
      await client("/api/user/save-progress", {
        method: "POST",
        body: {
          responses: questions.slice(0, 4).map((q) => ({
            questionId: q.id,
            selectedOption: Math.floor(Math.random() * q.options.length)
          }))
        }
      })
      continue
    }

    // Spread ability across the cohort so the histogram has shape.
    const skill = 0.25 + Math.random() * 0.65

    const responses = questions.map((question) => {
      if (Math.random() > 0.92) return { questionId: question.id, selectedOption: -1 }
      return {
        questionId: question.id,
        selectedOption: Math.floor(Math.random() * question.options.length)
      }
    })

    // Bias towards the correct answer for stronger candidates. The server holds
    // the answer key, so nudge by re-rolling weak guesses.
    for (const response of responses) {
      if (response.selectedOption >= 0 && Math.random() < skill) {
        response.selectedOption = 0 // seeded questions cluster correct answers low
      }
    }

    if (Math.random() < 0.15) {
      await client("/api/user/violation", { method: "POST", body: { type: "tab-switch" } })
      flagged += 1
    }

    const submit = await client("/api/user/submit-quiz", { method: "POST", body: { responses } })
    if (submit.status === 200) submitted += 1
  }

  console.log(`[demo] ${started} started, ${submitted} submitted, ${flagged} with a tab-switch flag`)
  console.log("[demo] open the admin panel to see the dashboard populated")
}

run().catch((error) => {
  console.error("[demo] failed:", error.message)
  process.exit(1)
})

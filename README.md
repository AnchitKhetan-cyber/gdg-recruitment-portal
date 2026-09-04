# GDG Recruitment Portal

A timed, proctored assessment platform for Google Developer Groups recruitment drives.
One repository holds all three pieces: the candidate portal, the organiser admin
panel, and the API that backs both.

Rebuilt from the 2025 portal
([frontend](https://github.com/lendrik-kumar/GDG_recruitment_portal_front),
[backend](https://github.com/lendrik-kumar/animated-chainsaw)). The architecture and
workflow are deliberately the same; the bugs are not. See
[docs/CHANGES.md](docs/CHANGES.md) for what changed and why.

---

## What is in here

| Path          | What it is                                    | Port   |
| ------------- | --------------------------------------------- | ------ |
| `backend/`    | Express 5 + Mongoose API, local MongoDB        | `8000` |
| `apps/portal/`| Candidate app - sign in, sit the test          | `5173` |
| `apps/admin/` | Organiser panel - tests, whitelist, results    | `5174` |
| `docs/`       | Architecture notes and the API reference       | -      |

---

## Quick start

You need **Node 20+**. MongoDB is optional for a first run.

```bash
git clone <this-repo> && cd gdg-recruitment-portal
npm run install:all
```

### Option A - no database installed (fastest)

Runs the API against a throwaway in-memory MongoDB, seeded with a sample test and
a handful of whitelisted candidates. Nothing is persisted.

```bash
npm run dev:mem
```

### Option B - local MongoDB

Install [MongoDB Community](https://www.mongodb.com/try/download/community) (or run
`docker compose up -d mongo`), then:

```bash
cp backend/.env.example backend/.env    # fill in JWT_SECRET and ADMIN_PASSWORD
npm run seed                            # create the sample test + whitelist
npm run dev
```

### Then, in two more terminals

```bash
npm run dev:portal    # http://localhost:5173
```

```bash
npm run dev:admin     # http://localhost:5174
```

Sign into the admin panel with the `ADMIN_PASSWORD` from `backend/.env`.

To fill the dashboard with realistic data, run `npm run demo -- --count 25` while the
API is up (requires `AUTH_ALLOW_INSECURE_DEV_LOGIN=true`).

---

## Configuration

Every variable is documented in `backend/.env.example`. The ones that matter:

| Variable                        | Notes                                                              |
| ------------------------------- | ------------------------------------------------------------------ |
| `MONGO_URI`                     | `mongodb://127.0.0.1:27017/gdg_recruitment` for a local install     |
| `JWT_SECRET`                    | Signs both session cookies. Must be long and random.               |
| `ADMIN_EMAILS`                  | Emails allowed into the admin panel via Google sign-in (allowlist) |
| `ADMIN_PASSWORD`                | Admin password fallback. Prefer `ADMIN_PASSWORD_HASH`.            |
| `ALLOWED_EMAIL_DOMAINS`         | Candidate email domains eligible to sit the test, e.g. `thapar.edu`|
| `CORS_ORIGINS`                  | Comma-separated list of allowed browser origins                    |
| `FIREBASE_*`                    | Service account used to verify candidate Google sign-in            |
| `MAX_VIOLATIONS`                | Tab switches allowed before the attempt is force-submitted         |
| `AUTH_ALLOW_INSECURE_DEV_LOGIN` | Dev only. Skips Firebase verification. Refused in production.      |

Generate a secret and an admin hash:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

```bash
npm run hash-admin-password --workspace=backend -- "your admin password"
```

### Firebase (candidate sign-in)

Candidates sign in with Google through Firebase Auth. The browser gets an ID token,
the API verifies it with `firebase-admin`, and only then issues a session cookie.

1. Create a Firebase project and enable **Google** under Authentication.
2. Copy the web config into `apps/portal/.env` (see `.env.example`).
3. Download a service account key and put its fields in `backend/.env`.
4. Add your portal domain to Firebase's authorised domains.

Without this the portal shows a "not configured" notice instead of the sign-in
button; the admin panel and API still work.

---

## How the test works

```
Candidate                        API                            MongoDB
    |                             |                                |
    |-- Google sign-in ---------->|                                |
    |                             |-- email domain eligible? ----->|
    |<-- httpOnly session cookie -|                                |
    |                             |                                |
    |-- start attempt ----------->|                                |
    |                             |-- draw N random questions ---->|
    |                             |   freeze them onto the user    |
    |                             |   stamp startedAt (the clock)  |
    |<-- paper, no answer key ----|                                |
    |                             |                                |
    |-- autosave (every 12s) ---->|-- merge answers, resync clock ->|
    |-- tab switch -------------->|-- count it; close at the limit >|
    |                             |                                |
    |-- submit ------------------>|-- grade against the frozen     |
    |                             |   snapshot, clear the session ->|
    |<-- "submitted" -------------|                                |
```

Three rules hold the whole design together:

1. **The server owns the clock.** Time remaining is derived from `startedAt` on
   every request. Clearing browser storage, reloading, or switching device gives
   no extra time.
2. **The paper is frozen per candidate.** Each attempt stores its own copy of the
   questions, so editing a test mid-drive cannot corrupt an attempt in flight.
3. **The answer key never leaves the server.** It is `select: false` on the model
   *and* stripped in `toJSON`, and only the grading and reviewer paths ask for it.

Full detail in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Admin panel

- **Dashboard** - cohort progress, score distribution, timing, integrity flags
- **Results** - searchable and filterable table, per-question review of any
  attempt, one-click shortlisting, CSV export, attempt reset
- **Tests** - create and edit tests; the correct option is chosen with a radio, so
  an out-of-range answer index cannot be saved. Exactly one test is live at a time.
- **Exceptions** - eligibility is by email domain (`ALLOWED_EMAIL_DOMAINS`, e.g.
  `thapar.edu`); this list only admits addresses from outside that domain

Admins sign in with Google, restricted to an explicit `ADMIN_EMAILS` allowlist,
with a password fallback (`ADMIN_PASSWORD` / `ADMIN_PASSWORD_HASH`).

---

## Testing

```bash
npm test
```

End-to-end checks run against a real in-memory MongoDB and the real HTTP stack -
the full candidate lifecycle, scoring correctness, the admin surface, domain
eligibility, and the input-hardening middleware. No mocks.

For a scaling test against a real database:

```bash
LOAD_TEST_MONGO_URI="mongodb://127.0.0.1:27017/gdg_load" npm run test:load -- --users 2000
```

---

## Deployment

```bash
cp .env.example .env          # set MONGO_ROOT_PASSWORD (repo-root .env)
docker compose up -d          # MongoDB + API
npm run build                 # static bundles for both front-ends
```

The MongoDB container runs with authentication and is **not** published to the
host - the API reaches it only over the internal compose network. Compose
refuses to start without `MONGO_ROOT_PASSWORD` set in the repo-root `.env`.

Serve `apps/portal/dist` and `apps/admin/dist` as static sites (Vercel, Netlify,
nginx). Set `VITE_API_URL` at build time to the deployed API origin, and list both
site origins in `CORS_ORIGINS`.

In production the API refuses to boot with `AUTH_ALLOW_INSECURE_DEV_LOGIN=true`, and
session cookies switch to `SameSite=None; Secure` so they work across domains -
which means the API **must** be served over HTTPS.

**Before a live drive:** set a strong `ADMIN_PASSWORD_HASH`, import the real
whitelist, create the real test and activate it, and confirm `/api/health` reports
`database: connected`.

---

## Licence

MIT

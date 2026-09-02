# Architecture

## Repository layout

```
gdg-recruitment-portal/
├── backend/                  Express 5 API (ESM)
│   ├── config/               env validation, Mongo connection, Firebase Admin
│   ├── models/               Mongoose schemas
│   ├── middlewares/          auth, rate limiting, sanitisation, error handling
│   ├── controllers/          request handlers
│   ├── routes/               route tables
│   ├── utils/                errors, responses, validation, scoring, CSV
│   ├── scripts/              seed, CSV import, dev servers, demo data
│   ├── tests/                end-to-end smoke suite
│   ├── app.js                builds the Express app (importable by tests)
│   └── server.js             boots it
│
└── apps/
    ├── portal/               candidate app
    └── admin/                organiser panel
        └── src/{api,components,pages,store,styles,utils}
```

`app.js` is separate from `server.js` so the test suite can mount the real app on an
ephemeral port without booting the production server.

---

## Data model

### `Allowed` — the whitelist

`email` (unique), `name`, `phone`, `tag`. Sign-in is refused for any address absent
from this collection. `tag` is a free-form cohort label ("2027", "web-dev").

### `Quiz` — the question bank

`title`, `description`, `duration` (minutes), `questions[]`, `questionsPerAttempt`,
`isActive`.

Each question carries `question`, `options[]`, `correctAnswers` (the index of the
right option), `answer` (derived text, for display), `image`, and `marks`.

A `pre("validate")` hook rewrites `answer` from `options[correctAnswers]` and rejects
an out-of-range index, so the two representations can never disagree.

Exactly one quiz has `isActive: true`. `Quiz.activateOnly(id)` sets it and clears the
flag on every other document.

### `User` — a candidate and their attempt

Identity (`firebaseUid`, `name`, `email`, `phone`), attempt state (`hasStarted`,
`hasSubmitted`, `startedAt`, `submittedAt`, `timeUsed`), results (`score`,
`maxScore`, `responses[]`), integrity (`violations[]`, `autoSubmitted`,
`autoSubmitReason`), review (`qualifiedForInterview`, `adminNotes`), and `quiz` — the
frozen snapshot of the paper served to this candidate.

Instance methods derive time from the server's own anchor:

```js
user.getTimeRemaining()   // seconds left, 0 once expired
user.getOverdueSeconds()  // seconds past the deadline, 0 while in time
user.getElapsedSeconds()  // seconds consumed, capped at the duration
user.getPublicQuiz()      // the paper with no answer key
```

---

## The three invariants

### 1. The server owns the clock

`startedAt` is stamped once, when the attempt begins. Everything else is derived:

```js
const elapsed = Math.floor((Date.now() - startedAt) / 1000)
const remaining = Math.max(0, duration * 60 - elapsed)
```

The browser runs a display countdown seeded from the server and re-synced on every
autosave. `timeUsed` at submission is computed server-side; the client cannot
influence it. An attempt found expired on any request is graded and closed there and
then.

### 2. The paper is frozen per candidate

`startQuiz` draws `questionsPerAttempt` questions at random and copies them onto the
user document. Every later request replays that snapshot. Editing the quiz mid-drive
therefore cannot change, reorder, or invalidate an attempt already in progress, and
grading always runs against exactly what the candidate saw.

### 3. The answer key never leaves the server

On the snapshot schema, `correctAnswers` and `answer` are `select: false` *and*
removed in a `toJSON` transform — belt and braces, because either alone can be
bypassed by a query that projects everything.

```js
User.findByIdWithAnswerKey(id)  // the only way to load them
```

Two callers use it: `finalizeAttempt` (grading) and `getResultById` (the reviewer's
per-question view, which is behind the admin session).

---

## Request flow

### Candidate

| Method | Route                      | Purpose                                        |
| ------ | -------------------------- | ---------------------------------------------- |
| `POST` | `/api/user/firebase-auth`  | Verify the Google ID token, issue a session     |
| `GET`  | `/api/user/verify`         | Session probe used by the route guard           |
| `POST` | `/api/user/start-quiz`     | Assign or resume the paper                      |
| `POST` | `/api/user/save-progress`  | Autosave answers, re-sync the clock             |
| `POST` | `/api/user/violation`      | Record a proctoring event                       |
| `POST` | `/api/user/submit-quiz`    | Grade, close the attempt, clear the session     |
| `GET`  | `/api/user/logout`         | Clear the session cookie                        |

The Firebase ID token is accepted **only** at sign-in. Everything after rides an
httpOnly `session` cookie, so no token is ever readable by page JavaScript.

### Admin

Everything under `/api/admin` except `login` sits behind `adminAuthMiddleware`,
applied once with `adminRoutes.use(...)` rather than repeated per route — so a new
route cannot accidentally ship unguarded.

Quizzes (`GET/POST/PUT/DELETE /quizzes`, `PUT /quizzes/:id/activate`), whitelist
(`/allowed-users`, plus `/bulk`), results (`/results`, `/results/:id`,
`/results/:id/qualification`, `/results/:id/reset`, `/results/shortlist`),
`/analytics`, and `/export-results`.

---

## Grading

`utils/scoring.js` is the only module that reads a correct answer.

```js
buildAnswerKey(questions)      // Map<questionId, {correctIndex, options, marks}>
gradeAttempt(submitted, key)   // { score, maxScore, attempted, total, responses }
mergeProgress(existing, incoming, validIds)   // autosave merge, no grading
```

`gradeAttempt` iterates the **answer key**, not the submission, so a question the
client omits still produces a row with `selectedOption: -1`. An index past the end of
the options list is treated as unanswered rather than trusted.

`finalizeAttempt` in the user controller is the single closing path, shared by manual
submission, time expiry, and the violation limit — so the three can never diverge. It
merges the last autosave with the final payload before grading, meaning a submission
that arrives with a partial body still counts everything saved earlier.

---

## Security

| Layer          | Measure                                                                  |
| -------------- | ------------------------------------------------------------------------ |
| Transport      | `helmet`, `nosniff`, `DENY` framing, `no-referrer`                        |
| CORS           | Explicit origin allowlist with credentials; trailing slashes normalised   |
| Sessions       | httpOnly JWT cookies; `SameSite=None; Secure` in production               |
| Roles          | Candidate and admin tokens carry distinct roles and are not interchangeable |
| Admin password | `timingSafeEqual`, or bcrypt via `ADMIN_PASSWORD_HASH`                    |
| Injection      | `$`-prefixed and prototype keys stripped from body, params, and query     |
| Regex          | User-supplied search terms escaped before reaching `$regex`               |
| Rate limiting  | 20/min sign-in, 120/min API, 10 per 15min admin login                     |
| Payloads       | 512 KB cap, `application/json` enforced on mutating verbs                 |
| Validation     | zod at every write boundary, Mongoose validators underneath               |
| Errors         | Central handler; internals never returned in production                   |
| Boot           | `assertEnv()` refuses to start on a misconfigured production deployment   |

---

## Front-end

Both apps are React 19 + Vite 7 + Tailwind v4 (CSS-first `@theme` tokens) + Zustand,
with axios talking to the API over cookies. In development Vite proxies `/api` to the
backend so cookie behaviour matches production exactly.

**Portal state** lives in two stores. `auth.store` caches the signed-in candidate for
instant paint but is never trusted — `ProtectedRoute` re-verifies the session with the
server on every guarded entry. `quiz.store` is the attempt state machine
(`idle → loading → ready → submitting → submitted`) and holds no timer anchor of its
own by design.

**Admin state** is deliberately not persisted: the admin cookie is the only
credential, and a reload re-verifies it.

Design tokens are shared between the two apps (`src/styles/index.css`): the four
Google brand hues as accents on a neutral surface. Chart colours are a separate,
darker set chosen for contrast and colour-vision separation — magnitude charts use a
single hue with direct labels, and the one categorical set (attempt status) carries a
text label on every segment, so nothing is communicated by colour alone.

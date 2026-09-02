# What changed from the 2025 portal

The architecture is intentionally unchanged: same layering
(`config → models → middlewares → controllers → routes`), same request flow, same
Firebase-then-cookie auth, same React + Vite + Zustand front-end. This document
lists what was **fixed**, so the differences are reviewable rather than mysterious.

Source repositories:
[frontend](https://github.com/lendrik-kumar/GDG_recruitment_portal_front),
[backend](https://github.com/lendrik-kumar/animated-chainsaw).

---

## Bugs found in the old code

### 1. Resumed answers were silently discarded

`startQuiz` returned the saved answers as `responses`, but the test page read
`res.data.response` (singular). The key never existed, so the branch never ran and a
candidate who reloaded lost every answer they had given.

**Now:** the field is `responses` on both sides, and a smoke test asserts that a
resumed attempt replays what was saved.

### 2. Clearing browser storage granted a fresh timer

`timeUsed` was only ever written at submission, so a resumed attempt always received
`timeUsed: 0`. The countdown was anchored to a `quizStartAt` value in `localStorage` -
so clearing site data reset the clock to the full duration.

**Now:** the server stamps `startedAt` when the attempt begins and derives the
remaining time from it on every request. The client's countdown is display only and
is re-synced from the server on each autosave. The submitted `timeUsed` is computed
server-side and the client's value is ignored entirely.

### 3. The answer key was stored on the candidate's own record

`startQuiz` copied `correctAnswers` and `answer` into the per-user quiz snapshot, and
`getResultById` returned the whole user document — answer key included.

**Now:** both fields are `select: false` on the snapshot schema *and* deleted in
`toJSON`. Only `User.findByIdWithAnswerKey()` asks for them, used by exactly two
places: grading, and the reviewer's per-question view. Two tests assert that no
candidate-facing or list response contains the string `correctAnswers`.

### 4. Answers were saved with the wrong type

`selectedOption` is a `Number` in the schema, but `evaluateResponses` wrote
`String(selectedIndex)`. Unanswered questions became the string `"-1"`, and questions
the candidate never reached were omitted from `responses` altogether.

**Now:** `selectedOption` is always a number, `-1` means unanswered, and every
question in the paper gets a response row so the review page is complete.

### 5. `submittedAt` was dropped

`user.submittedAt = new Date()` was assigned in `submitQuiz`, but the field was not in
the schema, so Mongoose discarded it. Nothing recorded when a candidate finished.

**Now:** `startedAt` and `submittedAt` are both schema fields, persisted and shown in
the admin panel.

### 6. Multi-quiz CRUD was unreachable

The admin API had full create/update/delete for quizzes, but `getRandomTest` and
`startQuiz` both called `Quiz.findOne()` — whichever document Mongo returned first.
Creating a second quiz could silently change which test candidates received.

**Now:** `Quiz.isActive` marks the live paper, `Quiz.activateOnly()` flips it
atomically, and the admin panel has an explicit "Make live" action. Deleting the
active test is refused while anyone is still writing it.

### 7. Proctoring ran entirely in the browser

The tab-switch counter lived in `localStorage` under `tabSwitchCount`, so a candidate
could edit it in devtools. It also fired on any `visibilitychange`, counting a
notification popup as a violation, and nothing was recorded server-side.

**Now:** violations are `POST`ed to the API, stored on the attempt with a type and a
timestamp, and the limit is enforced by the server, which closes the attempt itself.
A cooldown prevents one alt-tab from registering several events. The admin panel
shows the full proctoring log per candidate.

### 8. Failure paths navigated to a route that did not exist

Three error branches called `navigate('/login')`. No `/login` route was defined, so
the catch-all sent the candidate back to `/`, losing the error.

**Now:** failures surface an actionable message with a retry, and the routes the code
navigates to all exist.

### 9. Question `answer` text and `correctAnswers` index could disagree

Scoring preferred the index but fell back to comparing option text. Nothing kept the
two in sync, so an edited option could make a question unscoreable.

**Now:** the index is the single source of truth. A `pre("validate")` hook rewrites
`answer` from `options[correctAnswers]` on every save, and an out-of-range index is
rejected by both the API and the admin UI, which picks the correct option with a
radio button.

### 10. Smaller fixes

- `enforceJson` rejected every `DELETE` with 415, because no body means no
  `Content-Type`. It now only guards `POST`/`PUT`/`PATCH`.
- The rate limiter's `Map` grew without bound; expired buckets are now swept.
- Admin login compared passwords with `!==`, which leaks length through timing. It
  now uses `timingSafeEqual`, and supports a bcrypt hash instead of a plaintext
  password.
- CORS matched origins with trailing slashes that browsers never send, so two of the
  four configured production origins could never have matched.
- The error handler logged the raw error and returned a bare 500 for validation
  failures; Mongoose validation, cast, and duplicate-key errors now map to 400/409
  with a readable message.
- `getAllResults` interpolated the search term straight into a `$regex`, so a
  candidate named `a.*` matched everyone. It is now escaped.
- Score bands were hardcoded to a 15-question paper (`score >= 12` for "excellent").
  They are now percentages of the actual maximum.

---

## Things added, not just fixed

- **Autosave** (`POST /api/user/save-progress`) - a crashed browser loses nothing.
- **Per-question review** in the admin panel, showing what each candidate chose
  against what was correct.
- **Attempt reset**, so a genuine technical failure can be given a second sitting
  without editing the database by hand.
- **Auto-shortlist** by score then speed, and reviewer notes per candidate.
- **CSV import** for the whitelist, with per-line rejection reasons.
- **CSV export** as a real file download rather than a JSON string.
- **`questionsPerAttempt`** and **per-question marks** are configurable instead of
  hardcoded to 15 questions of 1 mark.
- **36 end-to-end tests** against a real in-memory MongoDB.
- **`npm run dev:mem`**, which runs the whole stack with no database installed.

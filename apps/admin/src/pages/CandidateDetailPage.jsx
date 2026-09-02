import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Check, RotateCcw, ShieldAlert, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { api } from "../api/client"
import {
  Badge,
  Button,
  Card,
  Spinner,
  StatusBadge,
  formatDate,
  formatDuration
} from "../components/ui"

const LETTERS = ["A", "B", "C", "D", "E", "F"]

/** Mirrors ENFORCED_VIOLATIONS on the server. */
const ENFORCED = new Set(["tab-switch", "window-blur", "fullscreen-exit"])

const CandidateDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .getResult(id)
      .then((result) => {
        setData(result)
        setNotes(result.user.adminNotes || "")
      })
      .catch((error) => {
        toast.error(error.message)
        navigate("/results", { replace: true })
      })
      .finally(() => setLoading(false))
  }, [id, navigate])

  const updateQualification = async (qualified) => {
    setSaving(true)
    try {
      await api.setQualification(id, { qualifiedForInterview: qualified, adminNotes: notes })
      setData((current) => ({
        ...current,
        user: { ...current.user, qualifiedForInterview: qualified, adminNotes: notes }
      }))
      toast.success(qualified ? "Shortlisted for interview" : "Removed from the shortlist")
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (
      !window.confirm(
        `Reset ${data.user.name}'s attempt?\n\nTheir answers and score are erased and they can sit the test again. This cannot be undone.`
      )
    ) {
      return
    }

    try {
      await api.resetAttempt(id)
      toast.success("Attempt reset")
      navigate("/results")
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Permanently delete ${data.user.name}'s record?\n\nThis removes the candidate and their submission entirely. This cannot be undone.`
      )
    ) {
      return
    }

    try {
      await api.deleteResult(id)
      toast.success("Candidate record deleted")
      navigate("/results")
    } catch (error) {
      toast.error(error.message)
    }
  }

  if (loading) return <Spinner label="Loading candidate" />
  if (!data) return null

  const { user, review } = data
  const percentage = user.maxScore ? Math.round((user.score / user.maxScore) * 100) : 0

  return (
    <div className="space-y-5">
      <Link
        to="/results"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to results
      </Link>

      {/* Summary */}
      <Card className="overflow-hidden">
        <div className="gdg-rule h-1" aria-hidden="true" />

        <div className="flex flex-wrap items-start justify-between gap-5 p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight text-ink">{user.name}</h1>
              <StatusBadge user={user} />
              {user.qualifiedForInterview && <Badge tone="green">Shortlisted</Badge>}
              {user.autoSubmitted && (
                <Badge tone="red">
                  <ShieldAlert className="size-3" aria-hidden="true" />
                  {user.autoSubmitReason === "violations-exceeded"
                    ? "Closed for tab switching"
                    : "Closed on time-out"}
                </Badge>
              )}
            </div>

            <p className="mt-1 text-sm text-ink-muted">
              {user.email}
              {user.phone && ` · ${user.phone}`}
            </p>

            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
              {[
                { label: "Score", value: `${user.score}/${user.maxScore}`, sub: `${percentage}%` },
                { label: "Time taken", value: formatDuration(user.timeUsed) },
                { label: "Started", value: formatDate(user.startedAt) },
                { label: "Submitted", value: formatDate(user.submittedAt) },
                { label: "Violations", value: user.violations?.length ?? 0 }
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-xs text-ink-subtle">{item.label}</dt>
                  <dd className="mt-0.5 font-mono text-lg font-semibold text-ink tabular-nums">
                    {item.value}
                    {item.sub && (
                      <span className="ml-1.5 text-xs font-normal text-ink-subtle">{item.sub}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex flex-col gap-2">
            {user.qualifiedForInterview ? (
              <Button variant="secondary" loading={saving} onClick={() => updateQualification(false)}>
                <X className="size-4" aria-hidden="true" />
                Remove from shortlist
              </Button>
            ) : (
              <Button
                variant="success"
                loading={saving}
                disabled={!user.hasSubmitted}
                onClick={() => updateQualification(true)}
              >
                <Check className="size-4" aria-hidden="true" />
                Shortlist for interview
              </Button>
            )}

            <Button variant="secondary" onClick={handleReset}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Reset attempt
            </Button>

            <Button variant="danger" onClick={handleDelete}>
              <Trash2 className="size-4" aria-hidden="true" />
              Delete record
            </Button>
          </div>
        </div>
      </Card>

      {/* Notes */}
      <Card className="p-5">
        <label htmlFor="notes" className="text-sm font-semibold text-ink">
          Reviewer notes
        </label>
        <p className="mt-0.5 text-xs text-ink-subtle">Visible to organisers only.</p>

        <textarea
          id="notes"
          rows={3}
          value={notes}
          maxLength={2000}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Strong on fundamentals, follow up on the system-design answer..."
          className="mt-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-subtle focus:border-gdg-blue"
        />

        <Button
          variant="primary"
          size="sm"
          loading={saving}
          onClick={() => updateQualification(user.qualifiedForInterview)}
          className="mt-2"
        >
          Save notes
        </Button>
      </Card>

      {/* Proctoring log */}
      {user.violations?.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink">Proctoring log</h2>
          <p className="mt-0.5 text-xs text-ink-subtle">
            Enforced events counted toward the auto-submit limit. Camera findings are
            machine guesses shown for your judgement — they never ended the attempt.
          </p>

          <ul className="mt-4 space-y-1.5">
            {user.violations.map((violation, index) => {
              const enforced = ENFORCED.has(violation.type)

              return (
                <li
                  key={`${violation.at}-${index}`}
                  className="flex flex-wrap items-center gap-2.5 text-sm text-ink-muted"
                >
                  <span className="w-6 font-mono text-xs text-ink-subtle tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <Badge tone={enforced ? "red" : "neutral"}>{violation.type}</Badge>

                  {!enforced && <span className="text-[11px] text-ink-subtle">review only</span>}

                  {violation.detail && (
                    <span className="text-xs text-ink">{violation.detail}</span>
                  )}

                  {typeof violation.confidence === "number" && (
                    <span className="font-mono text-[11px] text-ink-subtle">
                      {Math.round(violation.confidence * 100)}% confident
                    </span>
                  )}

                  <span className="ml-auto text-xs text-ink-subtle">
                    {formatDate(violation.at)}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {/* Per-question review */}
      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Answer review</h2>
          <p className="mt-0.5 text-xs text-ink-subtle">
            {review.filter((item) => item.isCorrect).length} correct of {review.length}
          </p>
        </div>

        {review.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-subtle">
            This candidate has not been assigned a paper.
          </p>
        ) : (
          <ol className="divide-y divide-line">
            {review.map((item) => (
              <li key={item.questionId} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      item.isCorrect
                        ? "bg-gdg-green/15 text-[#1b7a3d]"
                        : item.selectedOption < 0
                          ? "bg-canvas text-ink-subtle"
                          : "bg-gdg-red/10 text-gdg-red"
                    }`}
                    aria-hidden="true"
                  >
                    {item.isCorrect ? "✓" : item.selectedOption < 0 ? "–" : "✕"}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">
                      <span className="font-mono text-xs text-ink-subtle">Q{item.number}. </span>
                      {item.question}
                    </p>

                    <ul className="mt-2.5 grid gap-1.5">
                      {item.options.map((option, optionIndex) => {
                        const isCorrect = optionIndex === item.correctOption
                        const isChosen = optionIndex === item.selectedOption

                        return (
                          <li
                            key={optionIndex}
                            className={`flex items-center gap-2.5 rounded-lg border px-3 py-1.5 text-sm ${
                              isCorrect
                                ? "border-gdg-green/40 bg-gdg-green/[0.07] text-ink"
                                : isChosen
                                  ? "border-gdg-red/40 bg-gdg-red/[0.06] text-ink"
                                  : "border-line text-ink-muted"
                            }`}
                          >
                            <span className="font-mono text-xs text-ink-subtle">
                              {LETTERS[optionIndex]}
                            </span>
                            <span className="min-w-0 flex-1">{option}</span>

                            {isCorrect && <Badge tone="green">correct</Badge>}
                            {isChosen && !isCorrect && <Badge tone="red">chosen</Badge>}
                          </li>
                        )
                      })}
                    </ul>

                    {item.selectedOption < 0 && (
                      <p className="mt-2 text-xs text-ink-subtle">Left unanswered.</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}

export default CandidateDetailPage

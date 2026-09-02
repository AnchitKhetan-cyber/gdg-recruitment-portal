import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { CheckCircle2, FileQuestion, Plus, Radio, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { api } from "../api/client"
import { Badge, Button, Card, EmptyState, Spinner, formatDate } from "../components/ui"

const QuizzesPage = () => {
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const refresh = () => {
    setLoading(true)
    api
      .listQuizzes()
      .then((data) => setQuizzes(data.quizzes))
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  const handleActivate = async (quiz) => {
    setBusyId(quiz._id)
    try {
      await api.activateQuiz(quiz._id)
      toast.success(`"${quiz.title}" is now live`)
      refresh()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (quiz) => {
    if (!window.confirm(`Delete "${quiz.title}"? This cannot be undone.`)) return

    setBusyId(quiz._id)
    try {
      await api.deleteQuiz(quiz._id)
      toast.success("Test deleted")
      refresh()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Tests</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Exactly one test is live at a time. Candidates always receive the active one.
          </p>
        </div>

        <Link to="/quizzes/new">
          <Button variant="primary">
            <Plus className="size-4" aria-hidden="true" />
            New test
          </Button>
        </Link>
      </header>

      {loading ? (
        <Spinner label="Loading tests" />
      ) : quizzes.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileQuestion}
            title="No tests yet"
            body="Create a test and activate it before the drive opens, or candidates will have nothing to sit."
            action={
              <Link to="/quizzes/new">
                <Button variant="primary">Create the first test</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {quizzes.map((quiz) => (
            <Card key={quiz._id} className="flex flex-col overflow-hidden">
              {quiz.isActive && <div className="gdg-rule h-1" aria-hidden="true" />}

              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold text-ink">{quiz.title}</h2>
                  {quiz.isActive ? (
                    <Badge tone="green">
                      <Radio className="size-3" aria-hidden="true" />
                      Live
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Draft</Badge>
                  )}
                </div>

                <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted">{quiz.description}</p>

                <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                  {[
                    { label: "Duration", value: `${quiz.duration} min` },
                    { label: "Pool", value: `${quiz.questionCount} questions` },
                    { label: "Served", value: `${quiz.questionsPerAttempt} per candidate` }
                  ].map((item) => (
                    <div key={item.label}>
                      <dt className="text-[11px] text-ink-subtle">{item.label}</dt>
                      <dd className="font-mono text-sm font-semibold text-ink">{item.value}</dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-3 text-xs text-ink-subtle">Updated {formatDate(quiz.updatedAt)}</p>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                  <Link to={`/quizzes/${quiz._id}`}>
                    <Button size="sm">Edit</Button>
                  </Link>

                  {!quiz.isActive && (
                    <Button
                      size="sm"
                      variant="success"
                      loading={busyId === quiz._id}
                      onClick={() => handleActivate(quiz)}
                    >
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      Make live
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="danger"
                    className="ml-auto"
                    loading={busyId === quiz._id}
                    onClick={() => handleDelete(quiz)}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default QuizzesPage

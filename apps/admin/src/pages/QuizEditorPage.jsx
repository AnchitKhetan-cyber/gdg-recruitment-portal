import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { api } from "../api/client"
import { Badge, Button, Card, Input, Spinner } from "../components/ui"

const LETTERS = ["A", "B", "C", "D", "E", "F"]

const blankQuestion = () => ({
  key: crypto.randomUUID(),
  question: "",
  options: ["", "", "", ""],
  correctAnswers: 0,
  image: "",
  marks: 1
})

/**
 * Create/edit form for a test.
 *
 * The correct option is picked with a radio beside each option, so it is
 * impossible to save an index that points at an option that does not exist -
 * the failure mode that made scoring unreliable in the previous portal.
 */
const QuizEditorPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === "new"

  const [form, setForm] = useState({
    title: "",
    description: "",
    duration: 15,
    questionsPerAttempt: 15
  })
  const [questions, setQuestions] = useState([blankQuestion()])
  const [collapsed, setCollapsed] = useState({})
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isNew) return

    api
      .getQuiz(id)
      .then(({ quiz }) => {
        setForm({
          title: quiz.title,
          description: quiz.description,
          duration: quiz.duration,
          questionsPerAttempt: quiz.questionsPerAttempt
        })
        setQuestions(
          quiz.questions.map((question) => ({
            key: question._id,
            question: question.question,
            options: question.options,
            correctAnswers: question.correctAnswers,
            image: question.image || "",
            marks: question.marks ?? 1
          }))
        )
        // Long papers open collapsed, so the page is navigable.
        if (quiz.questions.length > 5) {
          setCollapsed(Object.fromEntries(quiz.questions.map((q) => [q._id, true])))
        }
      })
      .catch((error) => {
        toast.error(error.message)
        navigate("/quizzes", { replace: true })
      })
      .finally(() => setLoading(false))
  }, [id, isNew, navigate])

  const updateQuestion = (key, patch) =>
    setQuestions((current) => current.map((q) => (q.key === key ? { ...q, ...patch } : q)))

  const updateOption = (key, index, value) =>
    setQuestions((current) =>
      current.map((q) =>
        q.key === key ? { ...q, options: q.options.map((o, i) => (i === index ? value : o)) } : q
      )
    )

  const addOption = (key) =>
    setQuestions((current) =>
      current.map((q) => (q.key === key && q.options.length < 6 ? { ...q, options: [...q.options, ""] } : q))
    )

  const removeOption = (key, index) =>
    setQuestions((current) =>
      current.map((q) => {
        if (q.key !== key || q.options.length <= 2) return q
        const options = q.options.filter((_, i) => i !== index)
        // Keep the correct index pointing at the same option after a removal.
        let correct = q.correctAnswers
        if (index === correct) correct = 0
        else if (index < correct) correct -= 1
        return { ...q, options, correctAnswers: correct }
      })
    )

  const validate = () => {
    const found = {}

    if (form.title.trim().length < 3) found.title = "At least 3 characters"
    if (form.description.trim().length < 10) found.description = "At least 10 characters"
    if (form.duration < 1) found.duration = "At least 1 minute"

    if (questions.length === 0) found.questions = "Add at least one question"
    if (form.questionsPerAttempt > questions.length) {
      found.questionsPerAttempt = `Cannot serve ${form.questionsPerAttempt} from a pool of ${questions.length}`
    }

    questions.forEach((question, index) => {
      if (question.question.trim().length < 5) {
        found[`q-${question.key}`] = `Question ${index + 1}: needs at least 5 characters`
      } else if (question.options.some((option) => !option.trim())) {
        found[`q-${question.key}`] = `Question ${index + 1}: every option needs text`
      }
    })

    setErrors(found)
    return Object.keys(found).length === 0
  }

  const handleSave = async () => {
    if (!validate()) {
      toast.error("Fix the highlighted fields before saving")
      return
    }

    setSaving(true)

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      duration: Number(form.duration),
      questionsPerAttempt: Number(form.questionsPerAttempt),
      questions: questions.map((question) => ({
        question: question.question.trim(),
        options: question.options.map((option) => option.trim()),
        correctAnswers: question.correctAnswers,
        image: question.image.trim(),
        marks: Number(question.marks) || 1
      }))
    }

    try {
      if (isNew) {
        await api.createQuiz(payload)
        toast.success("Test created")
      } else {
        await api.updateQuiz(id, payload)
        toast.success("Test saved")
      }
      navigate("/quizzes")
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner label="Loading test" />

  return (
    <div className="space-y-5 pb-16">
      <Link
        to="/quizzes"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to tests
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {isNew ? "New test" : "Edit test"}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {questions.length} question{questions.length === 1 ? "" : "s"} in the pool
          </p>
        </div>

        <Button variant="primary" loading={saving} onClick={handleSave}>
          <Save className="size-4" aria-hidden="true" />
          {isNew ? "Create test" : "Save changes"}
        </Button>
      </header>

      {/* Test settings */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Settings</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input
            id="title"
            label="Title"
            value={form.title}
            error={errors.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="GDG Technical Screening 2026"
          />

          <Input
            id="description"
            label="Description"
            value={form.description}
            error={errors.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="A timed multiple-choice screening round"
          />

          <Input
            id="duration"
            label="Duration (minutes)"
            type="number"
            min={1}
            max={600}
            value={form.duration}
            error={errors.duration}
            onChange={(event) => setForm({ ...form, duration: event.target.value })}
          />

          <Input
            id="perAttempt"
            label="Questions per candidate"
            type="number"
            min={1}
            value={form.questionsPerAttempt}
            error={errors.questionsPerAttempt}
            hint="Drawn at random from the pool below, so no two candidates get the same paper"
            onChange={(event) => setForm({ ...form, questionsPerAttempt: event.target.value })}
          />
        </div>
      </Card>

      {/* Questions */}
      <div className="space-y-3">
        {questions.map((question, index) => {
          const isCollapsed = collapsed[question.key]
          const error = errors[`q-${question.key}`]

          return (
            <Card key={question.key} className={error ? "border-gdg-red/50" : ""}>
              <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                <span className="font-mono text-xs font-semibold text-ink-subtle">
                  Q{String(index + 1).padStart(2, "0")}
                </span>

                <p className="min-w-0 flex-1 truncate text-sm text-ink">
                  {question.question || <span className="text-ink-subtle">Untitled question</span>}
                </p>

                {error && <Badge tone="red">needs attention</Badge>}

                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [question.key]: !isCollapsed }))}
                  aria-label={isCollapsed ? "Expand question" : "Collapse question"}
                  aria-expanded={!isCollapsed}
                  className="rounded p-1 text-ink-subtle hover:bg-canvas hover:text-ink"
                >
                  {isCollapsed ? (
                    <ChevronDown className="size-4" aria-hidden="true" />
                  ) : (
                    <ChevronUp className="size-4" aria-hidden="true" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setQuestions((c) => c.filter((q) => q.key !== question.key))}
                  disabled={questions.length === 1}
                  aria-label={`Delete question ${index + 1}`}
                  className="rounded p-1 text-ink-subtle hover:bg-gdg-red/10 hover:text-gdg-red disabled:opacity-40"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>

              {!isCollapsed && (
                <div className="space-y-4 p-4">
                  {error && <p className="text-xs font-medium text-gdg-red">{error}</p>}

                  <Input
                    id={`question-${question.key}`}
                    label="Question"
                    value={question.question}
                    onChange={(event) => updateQuestion(question.key, { question: event.target.value })}
                    placeholder="What is the time complexity of binary search?"
                  />

                  <fieldset>
                    <legend className="mb-2 text-xs font-semibold text-ink-muted">
                      Options — select the correct one
                    </legend>

                    <div className="space-y-2">
                      {question.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-2.5">
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${question.key}`}
                              checked={question.correctAnswers === optionIndex}
                              onChange={() =>
                                updateQuestion(question.key, { correctAnswers: optionIndex })
                              }
                              aria-label={`Mark option ${LETTERS[optionIndex]} as correct`}
                              className="size-4 accent-[var(--color-gdg-green)]"
                            />
                            <span className="w-4 font-mono text-xs text-ink-subtle">
                              {LETTERS[optionIndex]}
                            </span>
                          </label>

                          <input
                            value={option}
                            onChange={(event) =>
                              updateOption(question.key, optionIndex, event.target.value)
                            }
                            placeholder={`Option ${LETTERS[optionIndex]}`}
                            className={`flex-1 rounded-lg border bg-surface px-3 py-2 text-sm outline-none transition focus:border-gdg-blue ${
                              question.correctAnswers === optionIndex
                                ? "border-gdg-green/50 bg-gdg-green/[0.05]"
                                : "border-line"
                            }`}
                          />

                          <button
                            type="button"
                            onClick={() => removeOption(question.key, optionIndex)}
                            disabled={question.options.length <= 2}
                            aria-label={`Remove option ${LETTERS[optionIndex]}`}
                            className="rounded p-1.5 text-ink-subtle hover:bg-canvas hover:text-gdg-red disabled:opacity-30"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {question.options.length < 6 && (
                      <Button size="sm" onClick={() => addOption(question.key)} className="mt-2.5">
                        <Plus className="size-3.5" aria-hidden="true" />
                        Add option
                      </Button>
                    )}
                  </fieldset>

                  <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                    <Input
                      id={`image-${question.key}`}
                      label="Image URL (optional)"
                      value={question.image}
                      onChange={(event) => updateQuestion(question.key, { image: event.target.value })}
                      placeholder="https://..."
                    />

                    <Input
                      id={`marks-${question.key}`}
                      label="Marks"
                      type="number"
                      min={0}
                      max={100}
                      value={question.marks}
                      onChange={(event) => updateQuestion(question.key, { marks: event.target.value })}
                    />
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setQuestions((current) => [...current, blankQuestion()])}>
          <Plus className="size-4" aria-hidden="true" />
          Add question
        </Button>

        {questions.length > 3 && (
          <Button
            onClick={() =>
              setCollapsed((current) =>
                Object.keys(current).length === questions.length
                  ? {}
                  : Object.fromEntries(questions.map((q) => [q.key, true]))
              )
            }
          >
            Toggle all
          </Button>
        )}

        <Button variant="primary" loading={saving} onClick={handleSave} className="ml-auto">
          <Save className="size-4" aria-hidden="true" />
          {isNew ? "Create test" : "Save changes"}
        </Button>
      </div>
    </div>
  )
}

export default QuizEditorPage

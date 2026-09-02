/**
 * The question grid. Three states only - answered, visited but unanswered, and
 * untouched - because a candidate scanning it under time pressure cannot parse
 * more than that.
 */
const QuestionPalette = ({ questions, answers, visited, currentIndex, onJump }) => (
  <nav aria-label="Question navigation">
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-5">
      {questions.map((question, index) => {
        const isCurrent = index === currentIndex
        const isAnswered = answers[question.id] !== undefined
        const isVisited = Boolean(visited[question.id])

        const tone = isCurrent
          ? "border-gdg-blue bg-gdg-blue text-white shadow-[0_0_0_3px_rgba(66,133,244,0.2)]"
          : isAnswered
            ? "border-gdg-green/40 bg-gdg-green/10 text-[#1b7a3d]"
            : isVisited
              ? "border-gdg-yellow/50 bg-gdg-yellow/10 text-[#8a6100]"
              : "border-line bg-surface text-ink-muted hover:border-gdg-blue/40 hover:bg-canvas"

        const state = isAnswered ? "answered" : isVisited ? "seen, not answered" : "not visited"

        return (
          <button
            key={question.id}
            type="button"
            onClick={() => onJump(index)}
            aria-current={isCurrent ? "true" : undefined}
            aria-label={`Question ${index + 1}, ${state}`}
            className={`h-10 rounded-lg border text-sm font-semibold tabular-nums transition-all ${tone}`}
          >
            {index + 1}
          </button>
        )
      })}
    </div>

    <ul className="mt-4 grid gap-2 text-xs text-ink-muted">
      <li className="flex items-center gap-2">
        <span className="size-3 rounded border border-gdg-green/40 bg-gdg-green/10" aria-hidden="true" />
        Answered
      </li>
      <li className="flex items-center gap-2">
        <span className="size-3 rounded border border-gdg-yellow/50 bg-gdg-yellow/10" aria-hidden="true" />
        Seen, not answered
      </li>
      <li className="flex items-center gap-2">
        <span className="size-3 rounded border border-line bg-surface" aria-hidden="true" />
        Not visited
      </li>
    </ul>
  </nav>
)

export default QuestionPalette

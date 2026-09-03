import { motion } from "framer-motion"
import { Check, Undo2 } from "lucide-react"

const LETTERS = ["A", "B", "C", "D", "E", "F"]

/**
 * One question and its options, rendered as a radio group.
 *
 * The options are real radio inputs so keyboard and screen-reader behaviour
 * comes for free; the visible control is drawn on top of a visually hidden one.
 */
const QuestionCard = ({ question, index, total, selectedOption, onSelect }) => {
  if (!question) return null

  const hasAnswer = selectedOption !== undefined && selectedOption >= 0

  return (
    <motion.article
      key={question.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="gdg-card overflow-hidden"
    >
      <div className="border-b border-line px-5 py-3 sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
          Question {index + 1}
          <span className="text-ink-subtle/60"> of {total}</span>
          {question.marks > 1 && (
            <span className="ml-2 rounded-full bg-gdg-blue/10 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-gdg-blue-dark">
              {question.marks} marks
            </span>
          )}
        </p>
      </div>

      <div className="px-5 py-6 sm:px-7">
        <h2 className="text-lg font-semibold leading-snug text-ink sm:text-xl">{question.question}</h2>

        {question.image && (
          <img
            src={question.image}
            alt=""
            loading="lazy"
            className="mt-5 max-h-72 w-auto rounded-xl border border-line object-contain"
          />
        )}

        <fieldset className="mt-6">
          <legend className="sr-only">Select one option</legend>

          <div className="grid gap-2.5">
            {question.options.map((option, optionIndex) => {
              const isSelected = selectedOption === optionIndex
              const id = `${question.id}-option-${optionIndex}`

              return (
                <label
                  key={id}
                  htmlFor={id}
                  className={`group relative flex cursor-pointer items-start gap-3.5 rounded-xl border p-3.5 transition-all sm:p-4 ${
                    isSelected
                      ? "border-gdg-blue bg-gdg-blue/[0.06] shadow-[0_0_0_1px_var(--color-gdg-blue)]"
                      : "border-line bg-surface hover:border-gdg-blue/40 hover:bg-canvas"
                  }`}
                >
                  {/*
                    Selecting and clearing need two handlers, because a radio
                    that is already checked fires `click` but no `change` - so
                    an onChange-only control can never be cleared. Browsers
                    fire `click` before `change`, and React does not re-render
                    between them, so `isSelected` is stable across the pair and
                    exactly one branch runs per interaction.
                  */}
                  <input
                    type="radio"
                    id={id}
                    name={`question-${question.id}`}
                    className="sr-only"
                    checked={isSelected}
                    onChange={() => {
                      if (!isSelected) onSelect(optionIndex)
                    }}
                    onClick={() => {
                      if (isSelected) onSelect(optionIndex)
                    }}
                  />

                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors ${
                      isSelected
                        ? "border-gdg-blue bg-gdg-blue text-white"
                        : "border-line bg-canvas text-ink-muted group-hover:border-gdg-blue/40"
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected ? <Check className="size-4" strokeWidth={3} /> : LETTERS[optionIndex]}
                  </span>

                  <span
                    className={`pt-0.5 text-[15px] leading-relaxed ${
                      isSelected ? "font-medium text-ink" : "text-ink-muted"
                    }`}
                  >
                    {option}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="mt-4 flex items-center gap-3">
          {hasAnswer ? (
            <>
              <button
                type="button"
                onClick={() => onSelect(selectedOption)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-gdg-red/40 hover:bg-gdg-red/[0.06] hover:text-gdg-red"
              >
                <Undo2 className="size-3.5" aria-hidden="true" />
                Clear answer
              </button>
              <span className="text-xs text-ink-subtle">
                Or click the selected option again.
              </span>
            </>
          ) : (
            <p className="text-xs text-ink-subtle">Not answered yet.</p>
          )}
        </div>
      </div>
    </motion.article>
  )
}

export default QuestionCard

/**
 * Chart primitives, hand-rolled in HTML/SVG.
 *
 * Colour decisions, and why:
 *  - Magnitude charts (histogram, score bands) use ONE hue. Identity is carried
 *    by the axis label, so there is no adjacent-pair separation problem and the
 *    bars read as a single measure rather than four unrelated categories.
 *  - The status trio is the one categorical set. Its steps were checked for
 *    colour-vision separation and 3:1 contrast; grey is a deliberate "nothing
 *    yet" state and every segment carries a text label, so nothing is
 *    communicated by colour alone.
 */

export const CHART = {
  hue: "#1A73E8",
  hueSoft: "rgba(26, 115, 232, 0.12)",
  status: {
    submitted: "#1A73E8",
    inProgress: "#B06000",
    notStarted: "#5F6368"
  }
}

/**
 * Horizontal bars for a small, named set of magnitudes.
 * Values are labelled directly, so the chart is readable without the axis.
 */
export const BarList = ({ items, total, emptyLabel = "No data yet" }) => {
  const max = Math.max(1, ...items.map((item) => item.value))

  if (!items.some((item) => item.value > 0)) {
    return <p className="py-8 text-center text-sm text-ink-subtle">{emptyLabel}</p>
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const share = total ? Math.round((item.value / total) * 100) : 0

        return (
          <li key={item.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-sm text-ink">{item.label}</span>
              <span className="font-mono text-xs text-ink-muted tabular-nums">
                {item.value}
                {total ? <span className="text-ink-subtle"> · {share}%</span> : null}
              </span>
            </div>

            <div className="h-2.5 overflow-hidden rounded-full bg-canvas">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${(item.value / max) * 100}%`,
                  backgroundColor: item.color || CHART.hue
                }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Score histogram. One hue; the bar under the pointer gets a tooltip, and the
 * same numbers are available as a table for anyone who cannot use hover.
 */
export const Histogram = ({ data, maxScore }) => {
  const peak = Math.max(1, ...data.map((bin) => bin.count))
  const hasData = data.some((bin) => bin.count > 0)

  if (!hasData) {
    return <p className="py-12 text-center text-sm text-ink-subtle">No submissions yet</p>
  }

  return (
    <div>
      <div className="flex h-44 items-stretch gap-[2px]" role="img" aria-label="Distribution of scores">
        {data.map((bin) => {
          const height = (bin.count / peak) * 100

          return (
            <div key={bin.score} className="group relative flex h-full flex-1 flex-col justify-end">
              <div
                className="relative rounded-t transition-[height] duration-500"
                style={{
                  height: `${height}%`,
                  backgroundColor: bin.count > 0 ? CHART.hue : "transparent",
                  minHeight: bin.count > 0 ? "4px" : "0"
                }}
              />

              {/* Hover affordance covering the full column, not just the bar. */}
              <div className="absolute inset-0" aria-hidden="true" />

              <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-white group-hover:block"
              >
                {bin.count} at {bin.score}/{maxScore}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex justify-between border-t border-line pt-2 font-mono text-[11px] text-ink-subtle">
        <span>0</span>
        <span>score</span>
        <span>{maxScore}</span>
      </div>
    </div>
  )
}

/**
 * Single stacked bar showing how the cohort splits across attempt states.
 * Segments are separated by a 2px surface gap so adjacent fills never merge.
 */
export const StatusBar = ({ segments, total }) => {
  if (!total) return <p className="py-4 text-sm text-ink-subtle">No candidates yet</p>

  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <div
              key={segment.label}
              style={{
                width: `${(segment.value / total) * 100}%`,
                backgroundColor: segment.color
              }}
              className="first:rounded-l-full last:rounded-r-full"
              title={`${segment.label}: ${segment.value}`}
            />
          ))}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: segment.color }}
              aria-hidden="true"
            />
            {segment.label}
            <span className="font-mono font-semibold text-ink tabular-nums">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A single headline number. Preferred over a chart when there is only one value. */
export const StatTile = ({ label, value, sublabel, icon: Icon, tone = "text-ink" }) => (
  <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
    <div className="flex items-start justify-between gap-2">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      {Icon && <Icon className="size-4 text-ink-subtle" aria-hidden="true" />}
    </div>
    <p className={`mt-2 font-mono text-3xl font-semibold tabular-nums ${tone}`}>{value}</p>
    {sublabel && <p className="mt-1 text-xs text-ink-subtle">{sublabel}</p>}
  </div>
)

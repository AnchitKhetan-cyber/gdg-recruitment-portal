import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Award, CheckCircle2, Clock, ShieldAlert, TrendingUp, Users } from "lucide-react"
import { toast } from "sonner"
import { api } from "../api/client"
import { Card, Spinner, formatDuration } from "../components/ui"
import { BarList, CHART, Histogram, StatTile, StatusBar } from "../components/charts"

const DashboardPage = () => {
  const [analytics, setAnalytics] = useState(null)
  const [activeQuiz, setActiveQuiz] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getAnalytics(), api.listQuizzes()])
      .then(([analyticsData, quizData]) => {
        setAnalytics(analyticsData.analytics)
        setActiveQuiz(quizData.quizzes.find((quiz) => quiz.isActive) || null)
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner label="Loading analytics" />
  if (!analytics) return null

  const { overview, scores, time, distribution, histogram, integrity } = analytics

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {activeQuiz ? (
            <>
              Live test: <span className="font-medium text-ink">{activeQuiz.title}</span> ·{" "}
              {activeQuiz.duration} min · {activeQuiz.questionsPerAttempt} of{" "}
              {activeQuiz.questionCount} questions per candidate
            </>
          ) : (
            <span className="text-gdg-red">
              No test is active. Candidates cannot start until you activate one.
            </span>
          )}
        </p>
      </header>

      {/* Headline numbers */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Registered" value={overview.total} icon={Users} sublabel="candidates signed in" />
        <StatTile
          label="Submitted"
          value={overview.submitted}
          icon={CheckCircle2}
          sublabel={`${overview.completionRate}% completion`}
        />
        <StatTile
          label="In progress"
          value={overview.inProgress}
          icon={Clock}
          tone={overview.inProgress > 0 ? "text-[#B06000]" : "text-ink"}
          sublabel="writing right now"
        />
        <StatTile
          label="Shortlisted"
          value={overview.qualified}
          icon={Award}
          sublabel="marked for interview"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Cohort split */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink">Cohort progress</h2>
          <p className="mt-0.5 text-xs text-ink-subtle">Where every registered candidate stands</p>

          <div className="mt-5">
            <StatusBar
              total={overview.total}
              segments={[
                { label: "Submitted", value: overview.submitted, color: CHART.status.submitted },
                { label: "In progress", value: overview.inProgress, color: CHART.status.inProgress },
                { label: "Not started", value: overview.notStarted, color: CHART.status.notStarted }
              ]}
            />
          </div>
        </Card>

        {/* Score summary */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink">Scores</h2>
          <p className="mt-0.5 text-xs text-ink-subtle">
            Across {overview.submitted} submitted attempt{overview.submitted === 1 ? "" : "s"}
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Average", value: scores.average },
              { label: "Median", value: scores.median },
              { label: "Highest", value: scores.highest },
              { label: "Lowest", value: scores.lowest }
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-xs text-ink-subtle">{stat.label}</dt>
                <dd className="mt-0.5 font-mono text-xl font-semibold text-ink tabular-nums">
                  {stat.value}
                  <span className="text-sm font-normal text-ink-subtle">/{scores.maxScore}</span>
                </dd>
              </div>
            ))}
          </dl>

          <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-line pt-4">
            {[
              { label: "Fastest", value: formatDuration(time.fastestSeconds) },
              { label: "Average time", value: formatDuration(time.averageSeconds) },
              { label: "Slowest", value: formatDuration(time.slowestSeconds) }
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-xs text-ink-subtle">{stat.label}</dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold text-ink tabular-nums">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Histogram */}
        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink">Score distribution</h2>
              <p className="mt-0.5 text-xs text-ink-subtle">How many candidates hit each score</p>
            </div>
            <TrendingUp className="size-4 text-ink-subtle" aria-hidden="true" />
          </div>

          <div className="mt-5">
            <Histogram data={histogram} maxScore={scores.maxScore} />
          </div>

          {/* Table view, so the same numbers are available without hover. */}
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-ink-subtle hover:text-ink">
              View as table
            </summary>
            <div className="mt-2 max-h-40 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-ink-subtle">
                  <tr>
                    <th className="py-1 font-medium">Score</th>
                    <th className="py-1 font-medium">Candidates</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {histogram
                    .filter((bin) => bin.count > 0)
                    .map((bin) => (
                      <tr key={bin.score} className="border-t border-line">
                        <td className="py-1">{bin.score}</td>
                        <td className="py-1">{bin.count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </details>
        </Card>

        {/* Bands + integrity */}
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">Performance bands</h2>
            <p className="mt-0.5 text-xs text-ink-subtle">As a share of the maximum score</p>

            <div className="mt-5">
              <BarList
                total={overview.submitted}
                emptyLabel="No submissions yet"
                items={[
                  { label: "80% and above", value: distribution.excellent },
                  { label: "60 - 79%", value: distribution.good },
                  { label: "40 - 59%", value: distribution.average },
                  { label: "Below 40%", value: distribution.poor }
                ]}
              />
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-ink-subtle" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">Integrity</h2>
            </div>

            <p className="mt-3 text-sm text-ink-muted">
              <span className="font-mono text-2xl font-semibold text-ink">
                {integrity.autoSubmitted}
              </span>{" "}
              attempt{integrity.autoSubmitted === 1 ? " was" : "s were"} closed automatically by the
              server, for running out of time or exceeding the tab-switch limit.
            </p>

            <Link
              to="/results?status=submitted"
              className="mt-4 inline-block text-xs font-semibold text-gdg-blue hover:underline"
            >
              Review submissions →
            </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage

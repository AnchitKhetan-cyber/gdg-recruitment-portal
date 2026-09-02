import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  ShieldAlert,
  Sparkles,
  Users
} from "lucide-react"
import { toast } from "sonner"
import { api } from "../api/client"
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  Spinner,
  StatusBadge,
  formatDuration
} from "../components/ui"

const PAGE_SIZE = 25

/** Debounces the search box so typing does not fire a request per keystroke. */
const useDebounced = (value, delay = 350) => {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timeout)
  }, [value, delay])

  return debounced
}

const ResultsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState("")
  const [status, setStatus] = useState(searchParams.get("status") || "all")
  const [qualified, setQualified] = useState("all")
  const [sortBy, setSortBy] = useState("score")
  const [order, setOrder] = useState("desc")
  const [page, setPage] = useState(1)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [shortlisting, setShortlisting] = useState(false)

  const debouncedSearch = useDebounced(search)

  const params = useMemo(
    () => ({ page, limit: PAGE_SIZE, search: debouncedSearch, status, qualified, sortBy, order }),
    [page, debouncedSearch, status, qualified, sortBy, order]
  )

  const refresh = useCallback(() => {
    setLoading(true)
    api
      .listResults(params)
      .then(setData)
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false))
  }, [params])

  useEffect(refresh, [refresh])

  // Reset to page 1 whenever a filter changes, so the view is never empty.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, status, qualified, sortBy, order])

  useEffect(() => {
    setSearchParams(status === "all" ? {} : { status }, { replace: true })
  }, [status, setSearchParams])

  const toggleSort = (field) => {
    if (sortBy === field) setOrder((current) => (current === "asc" ? "desc" : "asc"))
    else {
      setSortBy(field)
      setOrder("desc")
    }
  }

  const handleQualify = async (user, next) => {
    // Optimistic: the row flips immediately and rolls back only on failure.
    setData((current) => ({
      ...current,
      users: current.users.map((row) =>
        row._id === user._id ? { ...row, qualifiedForInterview: next } : row
      )
    }))

    try {
      await api.setQualification(user._id, { qualifiedForInterview: next })
    } catch (error) {
      toast.error(error.message)
      refresh()
    }
  }

  const handleExport = async () => {
    try {
      const { blob, filename } = await api.exportResults({ status, qualified, search: debouncedSearch })

      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      toast.success("Export downloaded")
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleShortlist = async () => {
    const input = window.prompt("Shortlist the top how many candidates? (by score, then speed)", "20")
    if (input === null) return

    const count = Number.parseInt(input, 10)
    if (!Number.isFinite(count) || count < 1) {
      toast.error("Enter a whole number of candidates")
      return
    }

    setShortlisting(true)
    try {
      const result = await api.shortlist({ count, replace: true })
      toast.success(`${result.qualified} candidate(s) shortlisted`)
      refresh()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setShortlisting(false)
    }
  }

  const stats = data?.stats

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Results</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {stats
              ? `${stats.total} registered · ${stats.submitted} submitted · ${stats.qualified} shortlisted`
              : "Loading..."}
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleShortlist} loading={shortlisting}>
            <Sparkles className="size-4" aria-hidden="true" />
            Auto-shortlist
          </Button>
          <Button variant="primary" onClick={handleExport}>
            <Download className="size-4" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </header>

      {/* Filters, in one row above the table */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-[2.15rem] size-4 text-ink-subtle"
              aria-hidden="true"
            />
            <Input
              id="search"
              label="Search"
              placeholder="Name or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="[&_input]:pl-9"
            />
          </div>

          <Select
            id="status"
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="in-progress">In progress</option>
            <option value="not-started">Not started</option>
          </Select>

          <Select
            id="qualified"
            label="Shortlist"
            value={qualified}
            onChange={(event) => setQualified(event.target.value)}
          >
            <option value="all">Everyone</option>
            <option value="yes">Shortlisted only</option>
            <option value="no">Not shortlisted</option>
          </Select>

          <Select
            id="sort"
            label="Sort by"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            <option value="score">Score</option>
            <option value="timeUsed">Time taken</option>
            <option value="submittedAt">Submitted at</option>
            <option value="name">Name</option>
            <option value="createdAt">Registered at</option>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading && !data ? (
          <Spinner label="Loading results" />
        ) : !data?.users.length ? (
          <EmptyState
            icon={Users}
            title="No candidates match these filters"
            body="Try clearing the search box or widening the status filter."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-sm">
                <thead className="border-b border-line bg-canvas text-left text-xs text-ink-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Candidate
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      <button
                        type="button"
                        onClick={() => toggleSort("score")}
                        className="inline-flex items-center gap-1 hover:text-ink"
                      >
                        Score
                        <ArrowUpDown className="size-3" aria-hidden="true" />
                      </button>
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      <button
                        type="button"
                        onClick={() => toggleSort("timeUsed")}
                        className="inline-flex items-center gap-1 hover:text-ink"
                      >
                        Time
                        <ArrowUpDown className="size-3" aria-hidden="true" />
                      </button>
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Flags
                    </th>
                    <th scope="col" className="px-4 py-3 text-center font-semibold">
                      Shortlist
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {data.users.map((user) => {
                    const percentage =
                      user.hasSubmitted && user.maxScore
                        ? Math.round((user.score / user.maxScore) * 100)
                        : null

                    return (
                      <tr key={user._id} className="border-b border-line last:border-0 hover:bg-canvas">
                        <td className="px-4 py-3">
                          <p className="font-medium text-ink">{user.name}</p>
                          <p className="text-xs text-ink-subtle">{user.email}</p>
                        </td>

                        <td className="px-4 py-3">
                          <StatusBadge user={user} />
                        </td>

                        <td className="px-4 py-3 font-mono tabular-nums">
                          {user.hasSubmitted ? (
                            <>
                              <span className="font-semibold text-ink">{user.score}</span>
                              <span className="text-ink-subtle">/{user.maxScore}</span>
                              <span className="ml-1.5 text-xs text-ink-subtle">{percentage}%</span>
                            </>
                          ) : (
                            <span className="text-ink-subtle">-</span>
                          )}
                        </td>

                        <td className="px-4 py-3 font-mono text-xs tabular-nums text-ink-muted">
                          {user.hasSubmitted ? formatDuration(user.timeUsed) : "-"}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {user.violationCount > 0 && (
                              <Badge tone="yellow">
                                <ShieldAlert className="size-3" aria-hidden="true" />
                                {user.violationCount}
                              </Badge>
                            )}
                            {user.autoSubmitted && <Badge tone="red">auto-submitted</Badge>}
                            {!user.violationCount && !user.autoSubmitted && (
                              <span className="text-xs text-ink-subtle">clean</span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={user.qualifiedForInterview}
                            onChange={(event) => handleQualify(user, event.target.checked)}
                            aria-label={`Shortlist ${user.name}`}
                            className="size-4 accent-[var(--color-gdg-green)]"
                          />
                        </td>

                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/results/${user._id}`}
                            className="text-xs font-semibold text-gdg-blue hover:underline"
                          >
                            Review
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-line px-4 py-3">
              <p className="text-xs text-ink-muted">
                Showing {(page - 1) * PAGE_SIZE + 1}-{(page - 1) * PAGE_SIZE + data.users.length} of{" "}
                {data.total}
              </p>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  <ChevronLeft className="size-3.5" aria-hidden="true" />
                  Previous
                </Button>
                <span className="font-mono text-xs text-ink-muted tabular-nums">
                  {page} / {data.totalPages}
                </span>
                <Button
                  size="sm"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

export default ResultsPage

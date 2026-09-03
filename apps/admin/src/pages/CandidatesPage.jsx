import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Plus, Search, Trash2, Upload, Users } from "lucide-react"
import { toast } from "sonner"
import { api } from "../api/client"
import { Badge, Button, Card, EmptyState, Input, Spinner, formatDate } from "../components/ui"

const PAGE_SIZE = 50
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^[0-9]{10}$/

/**
 * Parses a whitelist CSV in the browser so the operator sees exactly which rows
 * were rejected, and why, before anything is sent to the server.
 */
const parseCsv = (text) => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (!lines.length) return { entries: [], rejected: [] }

  const header = lines[0].split(",").map((cell) => cell.trim().toLowerCase())
  const hasHeader = header.includes("email")
  const columns = hasHeader ? header : ["name", "email", "phone", "tag"]
  const rows = hasHeader ? lines.slice(1) : lines

  const entries = []
  const rejected = []

  rows.forEach((line, index) => {
    const cells = line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""))
    const record = Object.fromEntries(columns.map((column, i) => [column, cells[i] || ""]))

    const entry = {
      name: record.name || "",
      email: (record.email || "").toLowerCase(),
      phone: (record.phone || "").replace(/\D/g, ""),
      tag: record.tag || ""
    }

    const lineNumber = index + (hasHeader ? 2 : 1)

    if (!EMAIL_REGEX.test(entry.email)) {
      rejected.push({ line: lineNumber, reason: `invalid email "${entry.email || "(blank)"}"` })
    } else if (!PHONE_REGEX.test(entry.phone)) {
      rejected.push({ line: lineNumber, reason: `phone must be 10 digits, got "${entry.phone}"` })
    } else if (entry.name.trim().length < 2) {
      rejected.push({ line: lineNumber, reason: "name is too short" })
    } else {
      entries.push(entry)
    }
  })

  return { entries, rejected }
}

const CandidatesPage = () => {
  const fileRef = useRef(null)

  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  const [draft, setDraft] = useState({ name: "", email: "", phone: "", tag: "" })
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importReport, setImportReport] = useState(null)

  const refresh = useCallback(() => {
    setLoading(true)
    api
      .listAllowed({ page, limit: PAGE_SIZE, search })
      .then((data) => {
        setEntries(data.entries)
        setTotal(data.total)
        setTotalPages(data.totalPages)
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false))
  }, [page, search])

  useEffect(() => {
    const timeout = setTimeout(refresh, 300)
    return () => clearTimeout(timeout)
  }, [refresh])

  const handleAdd = async (event) => {
    event.preventDefault()

    if (!EMAIL_REGEX.test(draft.email)) return toast.error("Enter a valid email address")
    if (!PHONE_REGEX.test(draft.phone)) return toast.error("Phone must be exactly 10 digits")
    if (draft.name.trim().length < 2) return toast.error("Enter the candidate's name")

    setAdding(true)
    try {
      await api.addAllowed(draft)
      toast.success(`${draft.email} whitelisted`)
      setDraft({ name: "", email: "", phone: "", tag: "" })
      refresh()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setAdding(false)
    }
  }

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportReport(null)

    try {
      const text = await file.text()
      const { entries: parsed, rejected } = parseCsv(text)

      if (!parsed.length) {
        setImportReport({ inserted: 0, skipped: 0, rejected })
        toast.error("No valid rows found in that file")
        return
      }

      const result = await api.bulkAddAllowed(parsed)
      setImportReport({ inserted: result.inserted, skipped: result.skipped, rejected })
      toast.success(`${result.inserted} added, ${result.skipped} already present`)
      refresh()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const handleDelete = async (entry) => {
    if (!window.confirm(`Remove ${entry.email} from the whitelist?`)) return

    try {
      await api.deleteAllowed(entry._id)
      toast.success("Removed")
      refresh()
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Exceptions</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Anyone with a <span className="font-medium text-ink">@thapar.edu</span> address can sign
          in without being listed here. Use this list to admit {total} address
          {total === 1 ? "" : "es"} from outside that domain &mdash; guests, or an organiser testing
          with a personal account.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Add one */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink">Admit an outside address</h2>

          <form onSubmit={handleAdd} className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              id="name"
              label="Name"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="Aarav Sharma"
            />
            <Input
              id="email"
              label="Email"
              type="email"
              value={draft.email}
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
              placeholder="aarav@example.com"
            />
            <Input
              id="phone"
              label="Phone"
              inputMode="numeric"
              maxLength={10}
              value={draft.phone}
              onChange={(event) =>
                setDraft({ ...draft, phone: event.target.value.replace(/\D/g, "") })
              }
              placeholder="9000000001"
            />
            <Input
              id="tag"
              label="Tag (optional)"
              value={draft.tag}
              onChange={(event) => setDraft({ ...draft, tag: event.target.value })}
              placeholder="2027"
            />

            <Button type="submit" variant="primary" loading={adding} className="sm:col-span-2">
              <Plus className="size-4" aria-hidden="true" />
              Add to whitelist
            </Button>
          </form>
        </Card>

        {/* Bulk import */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink">Import from CSV</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Header row: <code className="font-mono text-xs text-ink">name,email,phone,tag</code>.
            Emails already present are skipped, so re-uploading the same file is safe.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="sr-only"
            id="csv-upload"
          />

          <Button
            variant="secondary"
            loading={importing}
            onClick={() => fileRef.current?.click()}
            className="mt-4"
          >
            <Upload className="size-4" aria-hidden="true" />
            Choose a CSV file
          </Button>

          {importReport && (
            <div className="mt-4 rounded-lg border border-line bg-canvas p-3 text-sm">
              <p className="text-ink">
                <span className="font-semibold text-gdg-green">{importReport.inserted} added</span>
                {" · "}
                {importReport.skipped} already present
                {importReport.rejected.length > 0 && (
                  <>
                    {" · "}
                    <span className="font-semibold text-gdg-red">
                      {importReport.rejected.length} rejected
                    </span>
                  </>
                )}
              </p>

              {importReport.rejected.length > 0 && (
                <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-xs text-ink-muted">
                  {importReport.rejected.map((row) => (
                    <li key={row.line}>
                      <span className="font-mono">line {row.line}</span>: {row.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* List */}
      <Card className="overflow-hidden">
        <div className="border-b border-line p-4">
          <div className="relative max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search name, email, or phone"
              aria-label="Search the exceptions list"
              className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm outline-none transition focus:border-gdg-blue"
            />
          </div>
        </div>

        {loading && !entries.length ? (
          <Spinner label="Loading exceptions" />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? "No matches" : "No exceptions yet"}
            body={
              search
                ? "No candidate matches that search."
                : "Thapar addresses do not need listing. Add one here only to admit someone from outside the domain."
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-sm">
                <thead className="border-b border-line bg-canvas text-left text-xs text-ink-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Name
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Email
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Phone
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Tag
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Added
                    </th>
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry._id} className="border-b border-line last:border-0 hover:bg-canvas">
                      <td className="px-4 py-2.5 font-medium text-ink">{entry.name}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{entry.email}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-ink-muted">{entry.phone}</td>
                      <td className="px-4 py-2.5">
                        {entry.tag ? <Badge tone="blue">{entry.tag}</Badge> : null}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-ink-subtle">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(entry)}
                          aria-label={`Remove ${entry.email}`}
                          className="rounded p-1.5 text-ink-subtle hover:bg-gdg-red/10 hover:text-gdg-red"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-line px-4 py-3">
              <p className="text-xs text-ink-muted">
                {entries.length} of {total}
              </p>

              <div className="flex items-center gap-2">
                <Button size="sm" disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>
                  <ChevronLeft className="size-3.5" aria-hidden="true" />
                  Previous
                </Button>
                <span className="font-mono text-xs text-ink-muted tabular-nums">
                  {page} / {totalPages}
                </span>
                <Button size="sm" disabled={page >= totalPages} onClick={() => setPage((v) => v + 1)}>
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

export default CandidatesPage

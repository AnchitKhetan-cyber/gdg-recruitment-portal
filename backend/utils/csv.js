/** Escapes a single CSV cell per RFC 4180. */
const escapeCell = (value) => {
  const text = value === null || value === undefined ? "" : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

/**
 * Builds a CSV document from a header row and an array of row arrays.
 * A UTF-8 BOM is prepended so Excel renders non-ASCII names correctly.
 */
export const toCsv = (headers, rows, { bom = true } = {}) => {
  const body = [headers.map(escapeCell).join(","), ...rows.map((row) => row.map(escapeCell).join(","))].join(
    "\r\n"
  )
  return bom ? `\uFEFF${body}` : body
}

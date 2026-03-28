/**
 * Map catalog size names to short labels (XL, L, M, S) for PDP / cart.
 * Prefers `initial` when set; otherwise maps common full words from `name`.
 */

const FULL_NAME_RULES = [
  [/^(double\s+extra\s+large|xx[\s-]?large|2\s*xl|xxl|2xl)$/i, "XXL"],
  [/^(triple\s+extra\s+large|xxx[\s-]?large|3\s*xl|xxxl|3xl)$/i, "3XL"],
  [/^(quadruple\s+extra\s+large|4\s*xl|4xl)$/i, "4XL"],
  [/^(extra\s+large|x[\s-]?large|xlarge|xtra\s+large|xl)$/i, "XL"],
  [/^(large|lg)$/i, "L"],
  [/^(medium|med\.?)$/i, "M"],
  [/^(small|sm\.?)$/i, "S"],
  [/^(double\s+extra\s+small|xx[\s-]?small|xxs)$/i, "XXS"],
  [/^(extra\s+small|x[\s-]?small|xsmall|xs)$/i, "XS"],
  [/^(xxs)$/i, "XXS"],
  [/^(xs)$/i, "XS"],
  [/^(xxl|2xl)$/i, "XXL"],
  [/^(xl)$/i, "XL"],
  [/^(l)$/i, "L"],
  [/^(m)$/i, "M"],
  [/^(s)$/i, "S"],
]

function mapFullNameToAbbrev(raw) {
  if (!raw || typeof raw !== "string") return null
  const n = raw.trim().toLowerCase().replace(/\s+/g, " ")
  for (const [re, abbr] of FULL_NAME_RULES) {
    if (re.test(n)) return abbr
  }
  return null
}

function compactInitialDisplay(initial) {
  const t = String(initial).trim()
  if (!t) return null
  const mapped = mapFullNameToAbbrev(t)
  if (mapped) return mapped
  if (t.length <= 6 && !/\s/.test(t)) return t.toUpperCase()
  return t
}

/**
 * @param {{ name?: string, initial?: string, dimensions?: unknown } | null | undefined} row
 */
export function getSizeDisplayLabel(row) {
  if (!row || typeof row !== "object") return "Size"
  const initial = row.initial != null ? String(row.initial).trim() : ""
  const name = row.name != null ? String(row.name).trim() : ""

  if (initial) {
    const fromInitial = mapFullNameToAbbrev(initial) || compactInitialDisplay(initial)
    if (fromInitial) return fromInitial
  }
  if (name) {
    const fromName = mapFullNameToAbbrev(name)
    if (fromName) return fromName
    if (/^\d+(\.\d+)?$/.test(name)) return name
    return name
  }
  if (row.dimensions != null && String(row.dimensions).trim() !== "") return String(row.dimensions)
  return "Size"
}

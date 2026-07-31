/**
 * Parser for the source sheet's build strings.
 *
 * The format packs a whole recommendation into one cell:
 *
 *   固鎖：1-60 / 3-60 / 9-60 | 軸心：B / O / H #最強光棍王
 *   固鎖：7-60, 輔助W / 6-60, 輔助S | 軸心：LR / H #note\n冠軍配置：9-70, 輔助W, T
 *
 * 固鎖 = ratchet, 軸心 = bit, 輔助 = assist blade, 冠軍配置 = championship build.
 * A "#" starts free-text commentary and must be stripped before part matching,
 * otherwise words in the comment get read as part codes.
 */

export type Build = {
  /** Set when the line was labelled as a championship build. */
  championship: boolean
  ratchets: string[]
  bits: string[]
  assists: string[]
}

export type ParsedCombo = {
  builds: Build[]
  /** Commentary that followed a "#", joined across lines. */
  notes: string[]
}

const RATCHET_LABEL = '固鎖'
const BIT_LABEL = '軸心'
const ASSIST_LABEL = '輔助'
const CHAMPION_LABEL = '冠軍配置'

const RATCHET_CODE = /^\d+-\d+$/
const PART_CODE = /^[A-Za-z]{1,4}$/

/** Trailing notes in full-width brackets, e.g. "NR（天馬爆擊+腕龍鞭擊）". */
function stripBrackets(token: string): string {
  return token.replace(/[（(].*$/, '').trim()
}

/** Split on "/" and "," and drop empties — the sheet mixes both separators. */
function splitParts(raw: string): string[] {
  return raw
    .split(/[/,、]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

type Tokens = { ratchets: string[]; bits: string[]; assists: string[] }

/**
 * Reads one "/"-separated group from a labelled segment.
 *
 * Groups pack a whole sub-build: "7-60, 輔助W" is a ratchet with an assist,
 * "4-50, UF" is a ratchet with a bit, and "6-60, 輔助S, V" offers two assists.
 * So a bare letter means an assist once 輔助 has appeared in the group, and a
 * bit otherwise — which is how the source's own bracket-terminated regex reads it.
 */
function readGroup(group: string, into: Tokens, fallback: 'ratchet' | 'bit') {
  let sawAssist = false

  for (const rawToken of splitParts(group)) {
    const token = stripBrackets(rawToken)
    if (!token) continue

    if (token.startsWith(ASSIST_LABEL)) {
      const code = stripBrackets(token.slice(ASSIST_LABEL.length))
      if (code) into.assists.push(code)
      sawAssist = true
      continue
    }

    if (RATCHET_CODE.test(token)) {
      into.ratchets.push(token)
    } else if (PART_CODE.test(token)) {
      if (sawAssist) into.assists.push(token)
      else if (fallback === 'ratchet') into.bits.push(token)
      else into.bits.push(token)
    }
  }
}

function readSegment(value: string, into: Tokens, fallback: 'ratchet' | 'bit') {
  for (const group of value.split('/')) {
    if (group.trim()) readGroup(group, into, fallback)
  }
}

function parseLine(line: string): Build | null {
  const championship = line.includes(CHAMPION_LABEL)
  const body = line.replace(new RegExp(`${CHAMPION_LABEL}\\s*[:：]?`), '')

  const tokens: Tokens = { ratchets: [], bits: [], assists: [] }

  for (const segment of body.split('|')) {
    const trimmed = segment.trim()
    if (!trimmed) continue

    const [label, ...valueParts] = trimmed.split(/[:：]/)
    const value = valueParts.join(':').trim()

    if (label.includes(RATCHET_LABEL)) {
      readSegment(value, tokens, 'ratchet')
    } else if (label.includes(BIT_LABEL)) {
      readSegment(value, tokens, 'bit')
    } else if (!valueParts.length) {
      // An unlabelled tail like "9-70, 輔助W, T" — the championship line's
      // shorthand, where a bare letter is a bit unless an assist preceded it.
      readSegment(trimmed, tokens, 'bit')
    }
  }

  const { ratchets, bits, assists } = tokens
  if (!ratchets.length && !bits.length && !assists.length) return null

  return {
    championship,
    ratchets: [...new Set(ratchets)],
    bits: [...new Set(bits)],
    assists: [...new Set(assists)],
  }
}

export function parseCombo(raw?: string): ParsedCombo {
  if (!raw) return { builds: [], notes: [] }

  const notes: string[] = []
  const builds: Build[] = []

  // Normalise <br> to newlines, then peel off "#" commentary line by line.
  const lines = raw.replace(/<br\s*\/?>/gi, '\n').split(/\n+/)

  for (const line of lines) {
    const hashIndex = line.indexOf('#')
    const note = hashIndex >= 0 ? line.slice(hashIndex + 1).trim() : ''
    const body = hashIndex >= 0 ? line.slice(0, hashIndex) : line

    if (note) notes.push(note)

    const build = parseLine(body)
    if (build) builds.push(build)
  }

  return { builds, notes }
}

/** Flattened part codes across every build — used for reverse lookups. */
export function comboPartCodes(parsed: ParsedCombo): {
  ratchets: Set<string>
  bits: Set<string>
  assists: Set<string>
} {
  const ratchets = new Set<string>()
  const bits = new Set<string>()
  const assists = new Set<string>()

  for (const build of parsed.builds) {
    build.ratchets.forEach((r) => ratchets.add(r))
    build.bits.forEach((b) => bits.add(b))
    build.assists.forEach((a) => assists.add(a))
  }

  return { ratchets, bits, assists }
}

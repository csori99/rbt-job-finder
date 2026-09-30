const MIAMI_DADE = [
  'miami', 'hialeah', 'doral', 'kendall', 'homestead', 'florida city', 'coral gables', 'aventura',
  'north miami', 'miami beach', 'miami gardens', 'miami lakes', 'cutler bay', 'palmetto bay', 'pinecrest',
  'south miami', 'sweetwater', 'westchester', 'tamiami', 'fontainebleau', 'the hammocks', 'country walk',
  'richmond heights', 'princeton', 'naranja', 'leisure city', 'medley', 'opa-locka', 'opa locka',
  'north bay village', 'bal harbour', 'sunny isles', 'surfside', 'key biscayne', 'coconut grove',
  'little havana', 'brickell', 'wynwood', 'olympia heights', 'westwood lakes', 'kendall west',
  'kendale lakes', 'three lakes', 'redland', 'virginia gardens', 'miami springs', 'hialeah gardens',
  'miami shores', 'el portal', 'biscayne park', 'golden glades', 'ives estates', 'ojus', 'goulds',
  'west miami', 'coral terrace', 'glenvar heights', 'south miami heights', 'miami-dade', 'dade county',
]
const BROWARD = [
  'fort lauderdale', 'ft lauderdale', 'ft. lauderdale', 'hollywood', 'pembroke pines', 'miramar',
  'davie', 'plantation', 'sunrise', 'weston', 'coral springs', 'pompano beach', 'hallandale',
  'dania', 'cooper city', 'tamarac', 'lauderhill', 'lauderdale lakes', 'lauderdale-by-the-sea',
  'margate', 'coconut creek', 'deerfield beach', 'southwest ranches', 'west park', 'lighthouse point',
  'oakland park', 'wilton manors', 'parkland', 'north lauderdale', 'broward',
]

export function classifyArea(location = '') {
  const l = location.toLowerCase()
  if (BROWARD.some((c) => l.includes(c))) return 'broward'
  if (MIAMI_DADE.some((c) => l.includes(c))) return 'miami-dade'
  if (/\bremote\b/.test(l)) return 'remote'
  return 'other'
}

const TITLE_OK = /\b(rbt|registered behavior tech|behavior(al)? tech|behavior(al)? therapist|aba (therapist|tech|instructor|provider)|behavior interventionist|aba\b.*\btherap|behavior(al)? (health )?tech|autism (therapist|tech))/i
const TITLE_BAD = /\b(bcba|bcaba|behavior analyst|clinical director|supervisor|manager|coordinator|speech|slp|occupational|physical therap|nurse|rn\b|lpn|recruiter|psychologist|psychiatr|pharmac|dental|veterinar|mental health tech|psych tech|sales|scheduler|scheduling|intake|billing|admin\w*|receptionist|marketing|front desk|credentialing|authorization)\b/i

export function isRbtJob(title = '') {
  return TITLE_OK.test(title) && !TITLE_BAD.test(title)
}

export function stripHtml(html = '') {
  return html
    .replace(/<(br|\/p|\/li|\/div|\/h\d)[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&ndash;|&mdash;/g, '-')
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&bull;/g, '•')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

const num = (s) => parseFloat(s.replace(/,/g, ''))

export function parsePay(text = '', anchored = false) {
  const t = text.replace(/\s+/g, ' ')
  const range = /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*(k)?\s*(?:-|–|—|to)\s*\$?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*(k)?\s*(?:\/|per|an|a)?\s*(hour|hr|h\b|year|yr|annual|month|mo\b|week|wk|session|visit)?/i
  const single = /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*(k)?\s*(?:\/|per|an|a)?\s*(hour|hr|h\b|year|yr|annual|month|mo\b|week|wk|session|visit)?/i
  const at = (re) => (anchored ? new RegExp('^' + re.source, re.flags) : re)
  let min, max, unit
  const r = t.match(at(range))
  if (r) {
    min = num(r[1]) * (r[2] ? 1000 : 1)
    max = num(r[3]) * (r[4] || r[2] ? 1000 : 1)
    unit = r[5]
  } else {
    const s = t.match(at(single))
    if (!s) return null
    min = max = num(s[1]) * (s[2] ? 1000 : 1)
    unit = s[3]
  }
  unit = (unit || '').toLowerCase()
  let factor = 1
  if (/year|yr|annual/.test(unit) || (!unit && min > 1000)) factor = 1 / 2080
  else if (/month|mo/.test(unit)) factor = 1 / 173
  else if (/week|wk/.test(unit)) factor = 1 / 40
  else if (!unit && min > 200) return null
  const hMin = Math.round(min * factor * 100) / 100
  const hMax = Math.round(max * factor * 100) / 100
  if (hMin < 10 || hMax > 150) return null
  return { min: hMin, max: hMax }
}

function to24(h, ampm, fallbackPm) {
  let n = parseInt(h, 10)
  const ap = (ampm || '').toLowerCase().replace(/\./g, '')
  if (ap.startsWith('p') && n < 12) n += 12
  else if (ap.startsWith('a') && n === 12) n = 0
  else if (!ap && fallbackPm && n < 8) n += 12
  return n
}

export function extractTimeRanges(text = '') {
  const re = /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*(?:-|–|—|to|until)\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/gi
  const out = []
  for (const m of text.matchAll(re)) {
    const endAp = m[6]
    const end = to24(m[4], endAp)
    let start = to24(m[1], m[3] || (parseInt(m[1], 10) <= parseInt(m[4], 10) ? endAp : 'am'))
    if (start > 23 || end > 24) continue
    out.push({ start, end, raw: m[0].trim() })
  }
  return out
}

export function scoreSchedule(text = '') {
  const t = text.toLowerCase()
  const hints = []
  let score = 0
  if (/after[\s-]?school|afternoon|evening|pm shift|3\s?pm|4\s?pm|late day/.test(t)) {
    score = 2
    const m = t.match(/[^.\n]{0,60}(after[\s-]?school|afternoon|evening)[^.\n]{0,60}/)
    if (m) hints.push(m[0].trim())
  }
  for (const r of extractTimeRanges(text)) {
    hints.push(r.raw)
    if (r.end >= 16 && r.start >= 11) score = Math.max(score, 2)
    else if (r.end >= 17) score = Math.max(score, 1)
    else if (r.end <= 15 && score === 0) score = -1
  }
  if (score === 0 && /part[\s-]?time|flexible (schedule|hours)|make your own schedule|set your own/.test(t)) score = 1
  if (score === 0 && /(school[\s-]based|in[\s-]school|classroom).{0,40}(8|7):?\d{0,2}\s?am/.test(t)) score = -1
  return { score, hints: [...new Set(hints)].slice(0, 3) }
}

export function detectSetting(text = '') {
  const t = text.toLowerCase()
  const s = []
  if (/in[\s-]home|home[\s-]based|client'?s home/.test(t)) s.push('in-home')
  if (/clinic|center[\s-]based/.test(t)) s.push('clinic')
  if (/school[\s-]based|in[\s-]school/.test(t)) s.push('school')
  if (/telehealth/.test(t)) s.push('telehealth')
  return s
}

export function detectJobType(text = '') {
  const t = text.toLowerCase()
  const s = []
  if (/part[\s-]?time/.test(t)) s.push('part-time')
  if (/full[\s-]?time/.test(t)) s.push('full-time')
  if (/\bprn\b|per diem/.test(t)) s.push('PRN')
  if (/contract|1099/.test(t)) s.push('contract')
  return s
}

export function detectBilingual(text = '') {
  return /bilingual|spanish/i.test(text)
}

export function normDate(v) {
  if (!v || !/\d/.test(String(v))) return null
  const str = String(v)
  const hasYear = /\b(19|20)\d{2}\b/.test(str) || typeof v === 'number'
  let d = new Date(hasYear ? v : `${str} ${new Date().getFullYear()}`)
  if (isNaN(d)) return null
  if (d > Date.now() + 864e5) d.setFullYear(d.getFullYear() - 1)
  return d.toISOString()
}

export function parseWeeklyHours(text = '') {
  const t = text
    .split(/[.!?\n•]+(?=\s|$)|\n|•/)
    .filter((x) => !/bonus|averag|billable|training|notice/i.test(x))
    .join(' . ')
    .replace(/\s+/g, ' ')
  const unit = String.raw`(?:hours?|hrs?)\s*(?:per|a|each|\/|every)?\s*(?:week|wk)\b|(?:hours?|hrs?)\s*weekly\b|weekly\s*(?:hours?|hrs?)\b`
  const range = new RegExp(String.raw`(?<![\d.])(\d{1,2}(?:\.\d)?)\s*(?:-|–|—|to)\s*(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:${unit})`, 'i')
  const single = new RegExp(String.raw`(?:(up to|at least|minimum(?: of)?|min\.?|max(?:imum)?(?: of)?)\s*)?(?<![\d.])(\d{1,2}(?:\.\d)?)\s*(\+)?\s*(?:${unit})`, 'i')
  const reverse = /(?:weekly hours|hours per week|hours\/week)\s*:?\s*(\d{1,2})\s*(?:(?:-|–|to)\s*(\d{1,2}))?/i
  let min, max
  const r = t.match(range)
  if (r) {
    min = +r[1]
    max = +r[2]
  } else {
    const s = t.match(single)
    if (s) {
      const n = +s[2]
      const q = (s[1] || '').toLowerCase()
      if (q.startsWith('up to') || q.startsWith('max')) [min, max] = [null, n]
      else if (q || s[3]) [min, max] = [n, null]
      else [min, max] = [n, n]
    } else {
      const v = t.match(reverse)
      if (!v) return null
      min = +v[1]
      max = v[2] ? +v[2] : min
    }
  }
  if ((min != null && (min < 1 || min > 60)) || (max != null && (max < 1 || max > 60))) return null
  if (min != null && max != null && min > max) return null
  return { min: min ?? null, max: max ?? null }
}

export function detectShifts(text = '') {
  const t = text.toLowerCase()
  let morning = /\bmornings?\b|\bam (shift|sessions?|hours)|daytime|during the school day|school hours|early intervention/.test(t)
  let afternoon = /after[\s-]?school|afternoons?|evenings?|pm (shift|sessions?)|late day/.test(t)
  for (const r of extractTimeRanges(text)) {
    if (r.start < 12) morning = true
    if (r.end >= 16 || r.start >= 12) afternoon = true
  }
  if (morning && afternoon) return 'both'
  if (afternoon) return 'afternoon'
  if (morning) return 'morning'
  return null
}

export function parsePayAll(text = '') {
  const skip = /bonus|referral|sign[\s-]?on|stipend|mileage|per mile|reimburs|fee|cost|tuition|\bbcba\b|analyst|supervisor/i
  const vals = []
  for (const sentence of text.split(/(?<=[.!?])\s+|\n|•/)) {
    if (skip.test(sentence) || !sentence.includes('$')) continue
    let rest = sentence
    for (let guard = 0; guard < 6; guard++) {
      const i = rest.indexOf('$')
      if (i < 0) break
      const p = parsePay(rest.slice(i), true)
      if (p) vals.push(p.min, p.max)
      rest = rest.slice(i + 1).replace(/^[\d,.\s]*(k\b)?\s*(-|–|to)?\s*\$?[\d,.]*/i, '')
    }
  }
  const ok = vals.filter((v) => v >= 12 && v <= 60)
  return ok.length ? { min: Math.min(...ok), max: Math.max(...ok) } : null
}

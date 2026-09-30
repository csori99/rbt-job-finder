import { readFile, writeFile } from 'node:fs/promises'
import { SOURCES } from './sources.mjs'
import { EMPLOYERS, jobrapido } from './employers.mjs'
import { syncDiscards } from './discards.mjs'
import { jsearch } from './jsearch.mjs'

const ALL = { ...EMPLOYERS, jsearch, ...SOURCES, jobrapido }
import { locate } from './geo.mjs'
import { classifyArea, detectShifts, normDate, parseWeeklyHours, detectBilingual, detectJobType, detectSetting, parsePay, scoreSchedule } from './parse.mjs'

const OUT = new URL('../docs/jobs.json', import.meta.url)
const only = process.argv.slice(2)

function enrich(j) {
  const blob = [j.title, j.payText, j.jobType, j.description].filter(Boolean).join('\n')
  const pay = parsePay(j.payText || '') || parsePay(j.description || '')
  const hours = parseWeeklyHours(`${j.title}\n${j.jobType || ''}\n${j.description || ''}`)
  const sched = scoreSchedule(`${j.title}\n${j.jobType || ''}\n${j.description || ''}`)
  return {
    id: j.id,
    source: j.source,
    sourceKey: j.sourceKey,
    direct: !!j.direct,
    title: j.title,
    company: j.company || '',
    location: j.location || '',
    area: classifyArea(`${j.location} ${j.title}`),
    ...locate(`${j.location} ${j.title}`, j.geo),
    payText: j.payText || '',
    payMin: pay?.min ?? null,
    payMax: pay?.max ?? null,
    hoursMin: hours?.min ?? null,
    hoursMax: hours?.max ?? null,
    jobTypes: detectJobType(blob),
    setting: detectSetting(blob),
    bilingual: detectBilingual(blob),
    afternoon: sched.score,
    shift: detectShifts(`${j.title}\n${j.description || ''}`),
    scheduleHints: sched.hints,
    posted: normDate(j.posted),
    snippet: (j.description || '').slice(0, 600),
    url: j.url,
  }
}

const dedupeKey = (j) => `${j.title}|${j.company}|${j.location.split(',')[0]}`.toLowerCase().replace(/[^a-z0-9|]/g, '')

let prev = { jobs: [] }
try {
  prev = JSON.parse(await readFile(OUT, 'utf8'))
} catch {}
const prevById = new Map(prev.jobs.map((j) => [j.id, j]))
const now = new Date().toISOString()

const status = {}
const all = []
for (const [name, fn] of Object.entries(ALL)) {
  if (only.length && !only.includes(name)) continue
  const t = Date.now()
  try {
    const jobs = await fn()
    status[name] = { ok: true, count: jobs.length, ms: Date.now() - t }
    all.push(...jobs.map((j) => ({ ...j, sourceKey: name })))
  } catch (e) {
    status[name] = { ok: false, count: 0, error: String(e.message || e).slice(0, 200) }
  }
  console.log(name, status[name])
}

const byKey = new Map()
for (const raw of all) {
  const j = enrich(raw)
  if (j.area === 'other') continue
  const k = dedupeKey(j)
  let existing = byKey.get(k)
  if (existing && j.direct && !existing.direct) {
    j.alsoOn = [existing.source, ...(existing.alsoOn || [])]
    j.firstSeen = existing.firstSeen
    byKey.set(k, j)
    continue
  }
  if (existing) {
    existing.alsoOn = [...new Set([...(existing.alsoOn || []), j.source])].filter((s) => s !== existing.source)
    if (existing.payMin == null && j.payMin != null) Object.assign(existing, { payMin: j.payMin, payMax: j.payMax, payText: j.payText })
    if (existing.hoursMin == null && existing.hoursMax == null && (j.hoursMin != null || j.hoursMax != null)) Object.assign(existing, { hoursMin: j.hoursMin, hoursMax: j.hoursMax })
    if (!existing.shift && j.shift) existing.shift = j.shift
    if (existing.afternoon < j.afternoon) Object.assign(existing, { afternoon: j.afternoon, scheduleHints: j.scheduleHints })
    continue
  }
  j.firstSeen = prevById.get(j.id)?.firstSeen || now
  byKey.set(k, j)
}

let jobs = [...byKey.values()]
for (const [name, s] of Object.entries(status)) {
  if (s.ok && s.count > 0) continue
  const kept = prev.jobs.filter((j) => j.sourceKey === name && Date.now() - new Date(j.firstSeen).getTime() < 7 * 864e5)
  if (kept.length) {
    jobs.push(...kept.map((j) => ({ ...j, stale: true })))
    s.keptFromLastRun = kept.length
  }
}

jobs.sort((a, b) => (a.fromMiami ?? 99) - (b.fromMiami ?? 99) || (b.payMax ?? 0) - (a.payMax ?? 0))
await writeFile(OUT, JSON.stringify({ updatedAt: now, status, jobs }, null, 1))
console.log(`wrote ${jobs.length} jobs`)
console.log('discards', await syncDiscards().catch((e) => ({ ok: false, reason: e.message })))

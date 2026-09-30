import { readFile, writeFile } from 'node:fs/promises'
import { SOURCES } from './sources.mjs'
import { locate } from './geo.mjs'
import { classifyArea, detectBilingual, detectJobType, detectSetting, parsePay, scoreSchedule } from './parse.mjs'

const OUT = new URL('../docs/jobs.json', import.meta.url)
const only = process.argv.slice(2)

function enrich(j) {
  const blob = [j.title, j.payText, j.jobType, j.description].filter(Boolean).join('\n')
  const pay = parsePay(j.payText || '') || parsePay(j.description || '')
  const sched = scoreSchedule(`${j.title}\n${j.jobType || ''}\n${j.description || ''}`)
  return {
    id: j.id,
    source: j.source,
    title: j.title,
    company: j.company || '',
    location: j.location || '',
    area: classifyArea(`${j.location} ${j.title}`),
    ...locate(`${j.location} ${j.title}`, j.geo),
    payText: j.payText || '',
    payMin: pay?.min ?? null,
    payMax: pay?.max ?? null,
    jobTypes: detectJobType(blob),
    setting: detectSetting(blob),
    bilingual: detectBilingual(blob),
    afternoon: sched.score,
    scheduleHints: sched.hints,
    posted: j.posted || null,
    snippet: (j.description || '').slice(0, 600),
    url: j.url,
  }
}

const dedupeKey = (j) => `${j.title}|${j.company}`.toLowerCase().replace(/[^a-z0-9|]/g, '')

let prev = { jobs: [] }
try {
  prev = JSON.parse(await readFile(OUT, 'utf8'))
} catch {}
const prevById = new Map(prev.jobs.map((j) => [j.id, j]))
const now = new Date().toISOString()

const status = {}
const all = []
for (const [name, fn] of Object.entries(SOURCES)) {
  if (only.length && !only.includes(name)) continue
  const t = Date.now()
  try {
    const jobs = await fn()
    status[name] = { ok: true, count: jobs.length, ms: Date.now() - t }
    all.push(...jobs)
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
  const existing = byKey.get(k)
  if (existing) {
    existing.alsoOn = [...new Set([...(existing.alsoOn || []), j.source])].filter((s) => s !== existing.source)
    if (existing.payMin == null && j.payMin != null) Object.assign(existing, { payMin: j.payMin, payMax: j.payMax, payText: j.payText })
    if (existing.afternoon < j.afternoon) Object.assign(existing, { afternoon: j.afternoon, scheduleHints: j.scheduleHints })
    continue
  }
  j.firstSeen = prevById.get(j.id)?.firstSeen || now
  byKey.set(k, j)
}

let jobs = [...byKey.values()]
for (const [name, s] of Object.entries(status)) {
  if (s.ok && s.count > 0) continue
  const label = { linkedin: 'LinkedIn', simplyhired: 'SimplyHired / Indeed', talent: 'Talent.com', jobsora: 'Jobsora', craigslist: 'Craigslist' }[name]
  const kept = prev.jobs.filter((j) => j.source === label && Date.now() - new Date(j.firstSeen).getTime() < 7 * 864e5)
  if (kept.length) {
    jobs.push(...kept.map((j) => ({ ...j, stale: true })))
    s.keptFromLastRun = kept.length
  }
}

jobs.sort((a, b) => b.afternoon - a.afternoon || (b.payMax ?? 0) - (a.payMax ?? 0))
await writeFile(OUT, JSON.stringify({ updatedAt: now, status, jobs }, null, 1))
console.log(`wrote ${jobs.length} jobs`)

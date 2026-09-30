import { readFile, writeFile } from 'node:fs/promises'
import { isRbtJob } from './parse.mjs'

const CACHE = new URL('../data/jsearch-cache.json', import.meta.url)
const QUERIES = [
  'registered behavior technician in Miami, FL',
  'RBT in Davie, FL',
  'behavior technician in Miami, FL',
  'ABA therapist in Miami, FL',
  'RBT part time afternoon Miami, FL',
  'registered behavior technician in Fort Lauderdale, FL',
]
const KEEP_DAYS = 14
const MIN_REMAINING = 15

export async function jsearch() {
  const key = process.env.JSEARCH_KEY
  if (!key) throw new Error('JSEARCH_KEY not set')
  let cache = { runs: 0, remaining: null, jobs: {} }
  try {
    cache = JSON.parse(await readFile(CACHE, 'utf8'))
  } catch {}

  if (cache.remaining == null || cache.remaining > MIN_REMAINING || Date.now() > (cache.resetAt || 0)) {
    const q = QUERIES[cache.runs % QUERIES.length]
    const res = await fetch(`https://jsearch.p.rapidapi.com/search-v2?query=${encodeURIComponent(q)}&page=1&num_pages=1&country=us&date_posted=month`, {
      headers: { 'x-rapidapi-host': 'jsearch.p.rapidapi.com', 'x-rapidapi-key': key },
      signal: AbortSignal.timeout(30000),
    })
    const remaining = res.headers.get('x-ratelimit-requests-remaining')
    const reset = res.headers.get('x-ratelimit-requests-reset')
    if (remaining != null) cache.remaining = +remaining
    if (reset != null) cache.resetAt = Date.now() + +reset * 1000
    cache.runs++
    if (!res.ok) throw new Error(`jsearch ${res.status}`)
    const d = await res.json()
    const now = new Date().toISOString()
    for (const j of d.data?.jobs || d.data || []) cache.jobs[j.job_id] = { ...j, _seen: now }
  }

  const cutoff = Date.now() - KEEP_DAYS * 864e5
  for (const [id, j] of Object.entries(cache.jobs)) if (new Date(j._seen) < cutoff) delete cache.jobs[id]
  await writeFile(CACHE, JSON.stringify(cache))

  return Object.values(cache.jobs)
    .filter((j) => isRbtJob(j.job_title))
    .map((j) => {
      const direct = (j.apply_options || []).find((a) => a.is_direct)
      const period = (j.job_salary_period || 'hour').toLowerCase()
      return {
        id: `jsr-${j.job_id}`,
        source: `Google Jobs · ${j.job_publisher || 'JSearch'}`,
        title: j.job_title,
        company: j.employer_name || '',
        location: j.job_location || [j.job_city, j.job_state].filter(Boolean).join(', '),
        geo: j.job_latitude ? { lat: j.job_latitude, lng: j.job_longitude } : null,
        payText: j.job_min_salary ? `$${j.job_min_salary}${j.job_max_salary && j.job_max_salary !== j.job_min_salary ? ` - $${j.job_max_salary}` : ''} per ${period}` : (j.job_salary_string || '').replace(/^(?=\d)/, '$'),
        jobType: (j.job_employment_types || [j.job_employment_type]).filter(Boolean).join(', '),
        posted: j.job_posted_at_datetime_utc || null,
        description: j.job_description || '',
        url: direct?.apply_link || j.job_apply_link || j.job_google_link,
      }
    })
}

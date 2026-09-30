import { get, sleep } from './http.mjs'
import { isRbtJob } from './parse.mjs'

const SEARCHES = [
  ['registered behavior technician', 'Miami, FL'],
  ['behavior technician', 'Miami, FL'],
  ['rbt', 'Miami, FL'],
  ['aba therapist', 'Miami, FL'],
  ['behavior technician', 'Davie, FL'],
  ['rbt', 'Davie, FL'],
]

export async function adzuna() {
  const { ADZUNA_APP_ID: id, ADZUNA_APP_KEY: key } = process.env
  if (!id || !key) throw new Error('ADZUNA keys not set')
  const found = new Map()
  for (const [what, where] of SEARCHES) {
    for (let page = 1; page <= 2; page++) {
      const d = await get(`https://api.adzuna.com/v1/api/jobs/us/search/${page}?app_id=${id}&app_key=${key}&results_per_page=50&what=${encodeURIComponent(what)}&where=${encodeURIComponent(where)}&distance=40&max_days_old=30&content-type=application/json`, { json: true })
      for (const j of d.results || []) {
        if (!isRbtJob(j.title) || found.has(j.id)) continue
        const real = j.salary_min && !+j.salary_is_predicted
        found.set(j.id, {
          id: `az-${j.id}`,
          source: 'Adzuna',
          title: j.title.replace(/<[^>]+>/g, ''),
          company: j.company?.display_name || '',
          location: j.location?.display_name || '',
          geo: j.latitude ? { lat: j.latitude, lng: j.longitude } : null,
          payText: real ? `$${Math.round(j.salary_min)}${j.salary_max && j.salary_max !== j.salary_min ? ` - $${Math.round(j.salary_max)}` : ''} ${j.salary_min > 1000 ? 'a year' : 'an hour'}` : '',
          jobType: [j.contract_time, j.contract_type].filter(Boolean).join(', '),
          posted: j.created || null,
          description: (j.description || '').replace(/<[^>]+>/g, ''),
          url: j.redirect_url,
        })
      }
      if ((d.results || []).length < 50) break
      await sleep(1500)
    }
  }
  return [...found.values()]
}

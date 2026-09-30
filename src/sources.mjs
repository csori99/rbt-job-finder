import * as cheerio from 'cheerio'
import { get, mapLimit, sleep } from './http.mjs'
import { isRbtJob, stripHtml } from './parse.mjs'

export const QUERIES = ['RBT', 'Registered Behavior Technician', 'Behavior Technician', 'ABA Therapist']
export const LOCATIONS = [
  { li: 'Miami, Florida, United States', city: 'Miami, FL', slug: 'miami-fl' },
  { li: 'Davie, Florida, United States', city: 'Davie, FL', slug: 'davie-fl' },
]
const SEARCHES = LOCATIONS.flatMap((loc) => QUERIES.map((q) => ({ q, loc })))
const clean = (s = '') => s.replace(/\s+/g, ' ').trim()

export async function linkedin() {
  const found = new Map()
  for (const { q, loc } of SEARCHES) {
    for (let start = 0; start < 100; start += 25) {
      const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(q)}&location=${encodeURIComponent(loc.li)}&distance=25&f_TPR=r2592000&start=${start}`
      let html
      try {
        html = await get(url)
      } catch {
        break
      }
      const $ = cheerio.load(html)
      const cards = $('li')
      if (!cards.length) break
      cards.each((_, el) => {
        const c = $(el)
        const urn = c.find('[data-entity-urn]').attr('data-entity-urn') || ''
        const id = urn.split(':').pop()
        const title = clean(c.find('.base-search-card__title').text())
        if (!id || !isRbtJob(title) || found.has(id)) return
        found.set(id, {
          id: `li-${id}`,
          source: 'LinkedIn',
          title,
          company: clean(c.find('.base-search-card__subtitle').text()),
          location: clean(c.find('.job-search-card__location').text()),
          payText: clean(c.find('.job-search-card__salary-info').text()),
          posted: c.find('time').attr('datetime') || null,
          url: `https://www.linkedin.com/jobs/view/${id}`,
          _detail: `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`,
        })
      })
      await sleep(1200)
    }
  }
  const jobs = [...found.values()]
  await mapLimit(jobs, 3, async (j) => {
    const $ = cheerio.load(await get(j._detail))
    j.description = stripHtml($('.show-more-less-html__markup').html() || '')
    const crit = $('.description__job-criteria-item').map((_, e) => clean($(e).text())).get().join(' | ')
    j.jobType = crit
    if (!j.payText) j.payText = clean($('.salary.compensation__salary').text())
    await sleep(700)
  })
  return jobs
}

function nextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  return m ? JSON.parse(m[1]) : null
}

export async function simplyhired() {
  const found = new Map()
  for (const { q, loc } of SEARCHES) {
    let cursor = ''
    for (let page = 1; page <= 4; page++) {
      const url = `https://www.simplyhired.com/search?q=${encodeURIComponent(q)}&l=${encodeURIComponent(loc.city)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
      let d
      try {
        d = nextData(await get(url))
      } catch {
        break
      }
      const pp = d?.props?.pageProps
      if (!pp?.jobs?.length) break
      for (const j of pp.jobs) {
        if (!isRbtJob(j.title) || found.has(j.jobKey)) continue
        found.set(j.jobKey, {
          id: `sh-${j.jobKey}`,
          source: 'SimplyHired / Indeed',
          title: j.title,
          company: j.company,
          location: j.location,
          payText: j.salaryInfo || '',
          jobType: (j.jobTypes || []).join(', '),
          posted: j.dateOnIndeed ? new Date(j.dateOnIndeed).toISOString() : null,
          description: j.snippet || '',
          url: `https://www.simplyhired.com/job/${j.jobKey}`,
        })
      }
      cursor = pp.pageCursors?.[String(page + 1)]
      if (!cursor) break
      await sleep(1000)
    }
  }
  const jobs = [...found.values()]
  await mapLimit(jobs, 3, async (j) => {
    const pp = nextData(await get(j.url))?.props?.pageProps
    if (!pp) return
    if (pp.jobDescriptionHtml) j.description = stripHtml(pp.jobDescriptionHtml)
    if (pp.formattedLocation) j.location = pp.formattedLocation
    if (pp.latitude) j.geo = { lat: pp.latitude, lng: pp.longitude }
    await sleep(600)
  })
  return jobs
}

export async function talent() {
  const found = new Map()
  for (const { q, loc } of SEARCHES) {
    for (let p = 1; p <= 3; p++) {
      const url = `https://www.talent.com/jobs?k=${encodeURIComponent(q)}&l=${encodeURIComponent(loc.city)}&p=${p}`
      let html
      try {
        html = await get(url)
      } catch {
        break
      }
      const $ = cheerio.load(html)
      const cards = $('[data-new-id]')
      if (!cards.length) break
      cards.each((_, el) => {
        const c = $(el)
        const id = c.attr('data-new-id')
        const title = clean(c.find('h2').first().text())
        if (!isRbtJob(title) || found.has(id)) return
        const text = clean(c.text())
        found.set(id, {
          id: `ta-${id}`,
          source: 'Talent.com',
          title,
          company: clean(c.find('[class*="JobCard_company"]').text()),
          location: clean(c.find('[class*="JobCard_location"]').text()),
          payText: (text.match(/\$[\d,.]+(?:\s*-\s*\$[\d,.]+)?\s*(?:\/|per |an? )?\s*(?:hour|hr|year|week)/i) || [''])[0],
          description: clean(c.find('[class*="JobCard_snippet"], [class*="description"]').text()),
          posted: null,
          url: `https://www.talent.com/view?id=${id}`,
        })
      })
      await sleep(1000)
    }
  }
  const jobs = [...found.values()]
  await mapLimit(jobs, 3, async (j) => {
    const html = await get(j.url)
    for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      let d
      try {
        d = JSON.parse(m[1])
      } catch {
        continue
      }
      const posting = [d, ...(d['@graph'] || [])].find((x) => x['@type'] === 'JobPosting')
      if (!posting) continue
      j.description = stripHtml(posting.description || '')
      j.posted = posting.datePosted || j.posted
      j.jobType = [].concat(posting.employmentType || []).join(', ')
      const bs = posting.baseSalary?.value
      if (bs && !j.payText) j.payText = `$${bs.minValue ?? bs.value}${bs.maxValue ? ` - $${bs.maxValue}` : ''} per ${(bs.unitText || 'hour').toLowerCase()}`
    }
    await sleep(600)
  })
  return jobs
}

export async function jobsora() {
  const found = new Map()
  const slugs = ['rbt', 'behavior-technician', 'registered-behavior-technician', 'aba-therapist']
  for (const [q, loc] of LOCATIONS.flatMap((l) => slugs.map((q) => [q, l]))) {
    let html
    try {
      html = await get(`https://us.jobsora.com/jobs-${q}-${loc.slug}`)
    } catch {
      continue
    }
    const $ = cheerio.load(html)
    $('.c-job-item').each((_, el) => {
      const c = $(el)
      const a = c.find('.c-job-item__title a')
      const title = clean(a.text())
      const id = c.find('[data-vacancy-id]').attr('data-vacancy-id')
      if (!id || !isRbtJob(title) || found.has(id)) return
      const info = c.find('.c-job-item__info-item').map((_, e) => clean($(e).text())).get()
      const text = clean(c.text())
      found.set(id, {
        id: `js-${id}`,
        source: 'Jobsora',
        title,
        company: info[0] || '',
        location: info.find((x) => /, ?[A-Z]{2}\b|FL|Florida/.test(x)) || info[1] || '',
        payText: (text.match(/\$[\d,.]+(?:\s*[-–]\s*\$?[\d,.]+)?\s*(?:\/|per |an? )?\s*(?:hour|hr|year|week)?/i) || [''])[0],
        description: clean(c.find('.c-job-item__description, .c-job-item__snippet').text()),
        posted: null,
        url: a.attr('href'),
      })
    })
    await sleep(1000)
  }
  return [...found.values()]
}

export async function craigslist() {
  const found = new Map()
  for (const q of ['rbt', 'behavior technician', 'aba therapist']) {
    let html
    try {
      html = await get(`https://miami.craigslist.org/search/jjj?query=${encodeURIComponent(q)}`)
    } catch {
      continue
    }
    const $ = cheerio.load(html)
    $('li.cl-static-search-result').each((_, el) => {
      const c = $(el)
      const url = c.find('a').attr('href')
      const title = clean(c.find('.title').text() || c.attr('title'))
      if (!url || found.has(url) || !isRbtJob(title)) return
      found.set(url, {
        id: `cl-${url.match(/(\d+)\.html/)?.[1] || url}`,
        source: 'Craigslist',
        title,
        company: '',
        location: clean(c.find('.location').text()) || 'South Florida',
        payText: clean(c.find('.price').text()),
        posted: null,
        url,
      })
    })
    await sleep(1000)
  }
  const jobs = [...found.values()]
  await mapLimit(jobs, 2, async (j) => {
    const $ = cheerio.load(await get(j.url))
    $('#postingbody .print-information').remove()
    j.description = clean($('#postingbody').text().replace('QR Code Link to This Post', ''))
    const attrs = $('.attrgroup').text()
    const comp = attrs.match(/compensation:\s*([^\n]+)/i)
    if (comp) j.payText = clean(comp[1])
    j.jobType = clean((attrs.match(/employment type:\s*([^\n]+)/i) || [])[1] || '')
    j.posted = $('time.date').attr('datetime') || null
    await sleep(800)
  })
  return jobs
}

export const SOURCES = { linkedin, simplyhired, talent, jobsora, craigslist }

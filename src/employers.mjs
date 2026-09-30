import * as cheerio from 'cheerio'
import { get, mapLimit, sleep } from './http.mjs'
import { isRbtJob, stripHtml } from './parse.mjs'

const clean = (s = '') => s.replace(/\s+/g, ' ').trim()
const SOFLA = /miami|hialeah|doral|kendall|homestead|coral gables|aventura|cutler|pinecrest|palmetto bay|miami gardens|miami lakes|sweetwater|fort lauderdale|ft\.? lauderdale|hollywood|pembroke|miramar|davie|plantation|sunrise|weston|coral springs|pompano|hallandale|dania|cooper city|tamarac|lauderhill|margate|coconut creek|deerfield|broward|dade/i

function ldBlocks(html) {
  const out = []
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(m[1])
      out.push(d, ...(d['@graph'] || []))
    } catch {}
  }
  return out
}

export async function teampbs() {
  const urls = new Map()
  for (const county of ['miami-dade', 'broward']) {
    const html = await get(`https://www.teampbs.com/us/en/careers/details/fl/${county}`)
    const list = ldBlocks(html).find((d) => d['@type'] === 'ItemList')
    for (const it of list?.itemListElement || []) {
      if (/technician|rbt|behavior assistant/i.test(it.name)) urls.set(it.url, it.name)
    }
    await sleep(800)
  }
  const jobs = await mapLimit([...urls.keys()], 3, async (url) => {
    const blocks = ldBlocks(await get(url))
    const p = blocks.find((d) => d['@type'] === 'JobPosting')
    if (!p) return null
    const a = p.jobLocation?.address || {}
    const v = p.baseSalary?.value || {}
    const pay = v.value ?? v.minValue
    return {
      id: `pbs-${p.identifier?.value || url.split('-').pop()}`,
      source: 'Team PBS (company site)',
      direct: true,
      title: p.title.replace(/^Hiring\s+/i, '').replace(/ Roles at Team PBS in Florida/i, ''),
      company: 'Team PBS (Positive Behavior Supports)',
      location: [a.addressLocality, a.addressRegion, a.postalCode].filter(Boolean).join(', '),
      payText: pay ? `$${pay}${v.maxValue ? ` - $${v.maxValue}` : ''} per ${(v.unitText || 'hour').toLowerCase()}` : '',
      jobType: p.employmentType || '',
      posted: p.datePosted || null,
      description: stripHtml(p.description || ''),
      url,
    }
  })
  return jobs.filter(Boolean)
}

const ADP = [
  { cid: '49eaece0-251b-4b09-9f3b-9f7e2ea66f3f', name: 'LaCosta Therapy' },
  { cid: '66b52d18-782d-4f5d-b2d7-dd0d718b0f09', name: 'Behavior Analysis Inc' },
]

export async function adp() {
  const jobs = []
  for (const { cid, name } of ADP) {
    const d = await get(`https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions?cid=${cid}&lang=en_US&$top=100`, { json: true })
    for (const r of d.jobRequisitions || []) {
      if (!isRbtJob(r.requisitionTitle)) continue
      const locs = (r.requisitionLocations || []).map((l) => [l.address?.cityName, l.address?.countrySubdivisionLevel1?.codeValue].filter(Boolean).join(', '))
      const min = r.payGradeRange?.minimumRate?.amountValue
      const max = r.payGradeRange?.maximumRate?.amountValue
      jobs.push({
        id: `adp-${r.itemID}`,
        source: `${name} (company site)`,
        direct: true,
        title: r.requisitionTitle,
        company: name,
        location: locs.join(' / ') || 'South Florida',
        payText: min ? `$${min}${max && max !== min ? ` - $${max}` : ''} per hour` : '',
        jobType: r.workLevelCode?.shortName || '',
        posted: r.postDate || null,
        description: '',
        url: `https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=${cid}&ccId=19000101_000001&lang=en_US&selectedMenuKey=CurrentOpenings&jobId=${r.customFieldGroup?.stringFields?.find((f) => f.nameCode?.codeValue === 'ExternalJobID')?.stringValue || r.itemID}`,
      })
    }
    await sleep(800)
  }
  return jobs
}

export async function bfs() {
  const base = 'https://bfs.hrmdirect.com/employment/'
  const $ = cheerio.load(await get(`${base}job-openings.php?search=true`))
  const rows = $('tr.reqitem').map((_, el) => {
    const cells = $(el).find('td').map((_, td) => clean($(td).text())).get()
    const href = $(el).find('a').attr('href')
    return { cells, href }
  }).get()
  const jobs = []
  for (const { cells, href } of rows) {
    const title = cells.find((c) => isRbtJob(c))
    if (!title || !href) continue
    const location = cells.filter((c) => c !== title && SOFLA.test(c)).join(', ') || cells.slice(2).join(', ')
    jobs.push({
      id: `bfs-${href.match(/req=(\w+)/)?.[1] || href}`,
      source: 'Behavioral Family Solutions (company site)',
      direct: true,
      title,
      company: 'Behavioral Family Solutions',
      location,
      payText: '',
      posted: null,
      url: new URL(href, base).href,
    })
  }
  await mapLimit(jobs, 2, async (j) => {
    const $d = cheerio.load(await get(j.url))
    j.description = stripHtml($d('.jobDesc, #jobDesc, .reqResult, body').first().html() || '').slice(0, 4000)
  })
  return jobs
}

const GREENHOUSE = [
  { board: 'acornhealth', name: 'Acorn Health' },
  { board: 'bassabatherapy', name: 'Bassa ABA' },
  { board: 'kyocare', name: 'Kyo' },
]

export async function greenhouse() {
  const jobs = []
  for (const { board, name } of GREENHOUSE) {
    let d
    try {
      d = await get(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`, { json: true })
    } catch {
      continue
    }
    for (const j of d.jobs || []) {
      if (!isRbtJob(j.title) || !SOFLA.test(j.location?.name || '')) continue
      const desc = stripHtml(j.content?.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&') || '')
      jobs.push({
        id: `gh-${j.id}`,
        source: `${name} (company site)`,
        direct: true,
        title: j.title,
        company: name,
        location: j.location.name,
        payText: '',
        posted: j.updated_at || null,
        description: desc,
        url: j.absolute_url,
      })
    }
  }
  return jobs
}

export async function cultivate() {
  const d = await get('https://cultivate.rec.pro.ukg.net/CUL1007CULTI/JobBoard/2ed8df62-4087-44cc-a9f5-ae2da8ac1569/JobBoardView/LoadSearchResults', {
    json: true,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      opportunitySearch: { Top: 100, Skip: 0, QueryString: '', OrderBy: [], Filters: [] },
      matchCriteria: { PreferredJobs: [], Educations: [], LicenseAndCertifications: [], Skills: [], hasNoLicenses: false, SkippedSkills: [] },
    }),
  })
  return (d.opportunities || [])
    .map((o) => ({ o, loc: (o.Locations || []).map((l) => `${l.Address?.City || ''}, ${l.Address?.State?.Code || ''}`).join(' / ') }))
    .filter(({ o, loc }) => isRbtJob(o.Title) && SOFLA.test(loc))
    .map(({ o, loc }) => ({
      id: `ukg-${o.Id}`,
      source: 'Cultivate BHE (company site)',
      direct: true,
      title: o.Title,
      company: 'Cultivate Behavioral Health & Education',
      location: loc,
      payText: '',
      jobType: o.FullTime ? 'Full-time' : 'Part-time',
      posted: o.PostedDate || null,
      description: o.BriefDescription || '',
      url: `https://cultivate.rec.pro.ukg.net/CUL1007CULTI/JobBoard/2ed8df62-4087-44cc-a9f5-ae2da8ac1569/OpportunityDetail?opportunityId=${o.Id}`,
    }))
}

export async function steppingstones() {
  const xml = await get('https://jobs.thesteppingstonesgroup.com/feeds/jobs-rss')
  const $ = cheerio.load(xml, { xmlMode: true })
  const jobs = []
  $('item').each((_, el) => {
    const it = $(el)
    const title = clean(it.find('title').text())
    const desc = clean(it.find('description').text())
    const [where = '', , pay = ''] = desc.split('|').map((s) => s.trim())
    if (!/florida/i.test(where) || !SOFLA.test(where)) return
    if (!isRbtJob(title) && !/behavio(u)?ral\/autism support/i.test(desc)) return
    jobs.push({
      id: `ssg-${clean(it.find('guid').text()) || clean(it.find('link').text())}`,
      source: 'Stepping Stones Group (company site)',
      direct: true,
      title,
      company: 'The Stepping Stones Group',
      location: where.replace(/^USA,\s*/, '').split(',').reverse().map((s) => s.trim()).join(', '),
      payText: /\d/.test(pay) ? `$${pay.replace(/\s*-\s*/, ' - $')} per hour` : '',
      posted: it.find('pubDate').text() ? new Date(it.find('pubDate').text()).toISOString() : null,
      description: desc,
      url: clean(it.find('link').text()),
    })
  })
  return jobs
}

export async function jobrapido() {
  const found = new Map()
  for (const loc of ['miami, fl', 'davie, fl']) {
    for (const q of ['rbt', 'behavior technician', 'aba therapist']) {
      for (let p = 1; p <= 3; p++) {
        let html
        try {
          html = await get(`https://us.jobrapido.com/?w=${encodeURIComponent(q)}&l=${encodeURIComponent(loc)}&p=${p}`)
        } catch {
          break
        }
        const ads = [...html.matchAll(/data-advert='([^']*)'/g)]
        if (!ads.length) break
        for (const m of ads) {
          let a
          try {
            a = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'))
          } catch {
            continue
          }
          const title = stripHtml(a.title || '')
          const key = a.advertId || a.openAdvertUrl
          if (!isRbtJob(title) || found.has(key)) continue
          found.set(key, {
            id: `jr-${key}`,
            source: 'Jobrapido',
            title,
            company: a.company || '',
            location: a.location || '',
            payText: a.salary || '',
            posted: a.date || null,
            description: stripHtml(a.description || a.snippet || ''),
            url: a.openAdvertUrl?.startsWith('http') ? a.openAdvertUrl : `https://us.jobrapido.com${a.openAdvertUrl || ''}`,
          })
        }
        await sleep(900)
      }
    }
  }
  return [...found.values()]
}

export const EMPLOYERS = { teampbs, adp, bfs, greenhouse, cultivate, steppingstones }

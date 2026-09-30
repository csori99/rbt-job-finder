const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function get(url, { json = false, headers = {}, method = 'GET', body, retries = 2 } = {}) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, {
        method,
        body,
        headers: {
          'user-agent': UA,
          'accept-language': 'en-US,en;q=0.9',
          accept: json ? 'application/json' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          ...headers,
        },
        signal: AbortSignal.timeout(25000),
      })
      if (res.status === 429 && i < retries) {
        await sleep(3000 * (i + 1))
        continue
      }
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      return json ? res.json() : res.text()
    } catch (e) {
      if (i >= retries) throw e
      await sleep(1500 * (i + 1))
    }
  }
}

export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let idx = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (idx < items.length) {
        const i = idx++
        try {
          out[i] = await fn(items[i], i)
        } catch (e) {
          out[i] = undefined
        }
      }
    }),
  )
  return out
}

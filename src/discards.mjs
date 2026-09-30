import { readFile, writeFile } from 'node:fs/promises'

const OUT = new URL('../data/discards.json', import.meta.url)

async function config() {
  try {
    const src = await readFile(new URL('../docs/config.js', import.meta.url), 'utf8')
    const url = src.match(/supabaseUrl:\s*'([^']*)'/)?.[1]
    const key = src.match(/supabaseAnonKey:\s*'([^']*)'/)?.[1]
    return url && key ? { url, key } : null
  } catch {
    return null
  }
}

export async function syncDiscards() {
  const cfg = await config()
  if (!cfg) return { ok: false, reason: 'supabase not configured' }
  const res = await fetch(`${cfg.url}/rest/v1/discards?select=*&order=updated_at.desc`, {
    headers: { apikey: cfg.key, authorization: `Bearer ${cfg.key}` },
  })
  if (!res.ok) return { ok: false, reason: `supabase ${res.status}` }
  const rows = await res.json()
  await writeFile(OUT, JSON.stringify(rows, null, 1))
  return { ok: true, count: rows.filter((r) => r.discarded).length }
}

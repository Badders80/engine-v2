/**
 * Social URLs are stored whole and shown as handles: a profile should read
 * `@copperbelt_stc`, not a URL that spills across the row. The link still
 * points at the full URL.
 */
export function socialHandle(url: string): string {
  try {
    const parsed = new URL(url)
    const segment = parsed.pathname.split('/').filter((part) => part !== '')[0]
    const raw = segment ?? parsed.hostname
    const handle = decodeURIComponent(raw).replace(/^@/, '')
    return handle === '' ? parsed.hostname : `@${handle}`
  } catch {
    const raw = url.trim()
    return raw.startsWith('@') ? raw : `@${raw}`
  }
}

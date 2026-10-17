import type { NextConfig } from 'next'

/**
 * The R2 public origin, as an `images.remotePatterns` entry, when it is configured.
 *
 * `next/image` refuses a remote host it has not been told about, so the horse's
 * hero image needs this. The origin is read from the environment rather than
 * written out because it differs between the local stack and production, and a
 * hardcoded host would make one of them serve broken images.
 *
 * Unset is a normal state, not an error: CI builds with no environment variables,
 * both pages are server-rendered per request, and `heroImageUrl` renders the
 * no-photo placeholder when there is no origin. So a missing or malformed value
 * narrows the allow-list to nothing and lets the build proceed, rather than
 * failing a build for a reason unrelated to the change.
 */
function r2RemotePattern(): { protocol: 'https'; hostname: string } | null {
  const origin = (process.env.WEBSITE_R2_PUBLIC_URL ?? '').trim()
  if (origin === '') return null

  try {
    const { protocol, hostname } = new URL(origin)
    if (protocol !== 'https:' || hostname === '') return null
    return { protocol: 'https', hostname }
  } catch {
    return null
  }
}

const r2 = r2RemotePattern()

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(r2 ? { images: { remotePatterns: [r2] } } : {}),
}

export default nextConfig

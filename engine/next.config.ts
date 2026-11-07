import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The operator uploads one horse image per Server Action. Next's default
  // request body limit is 1 MB, and a camera-resolution hero is routinely
  // larger: the first Mulan hero is 1.1 MB, so the upload failed with
  // `Body exceeded 1 MB limit` before the storage helper ever ran.
  experimental: {
    serverActions: {
      bodySizeLimit: '15mb',
    },
  },
  // The legal templates are read at request time by `src/lib/legal/templates.ts`.
  // Without this, the preview route works under `next dev` and fails in the
  // deployed server with ENOENT, because the files are not part of the traced
  // output. The verification confirms both templates reach the built server.
  outputFileTracingIncludes: {
    '/*': ['./src/templates/**/*.md'],
  },
}

export default nextConfig

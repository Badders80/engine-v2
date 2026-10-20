import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The legal templates are read at request time by `src/lib/legal/templates.ts`.
  // Without this, the preview route works under `next dev` and fails in the
  // deployed server with ENOENT, because the files are not part of the traced
  // output. The verification confirms both templates reach the built server.
  outputFileTracingIncludes: {
    '/*': ['./src/templates/**/*.md'],
  },
}

export default nextConfig

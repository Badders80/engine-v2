import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import localFont from 'next/font/local'
import { Instrument_Serif } from 'next/font/google'
import './globals.css'

import { Footer } from '../components/Footer'
import { NavBar } from '../components/NavBar'
import { OG_IMAGE, SITE_URL } from '../lib/site'

// Geist Mono — financials, hashes, countdowns, tabular figures, and the
// editorial voice (standfirsts, eyebrows). Self-hosted: the variable font ships
// with the brand folder, so the build does not reach the network for it.
const geistMono = localFont({
  src: './fonts/GeistMono-VF.woff2',
  variable: '--font-geist-mono',
  display: 'swap',
  weight: '100 900',
})

// Instrument Serif — reserved drama. One italic gold word inside a page
// headline, and nothing else. Italic cut only.
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: 'italic',
  variable: '--font-instrument-serif',
  display: 'swap',
})

const SITE_NAME = 'Evolution Stables'
const SITE_DESCRIPTION =
  'Digital syndication for thoroughbred ownership. Regulated, transparent, and built on the horse.'

/**
 * Step 6b-ii. The site-level half of the search layer.
 *
 * `metadataBase` is what turns every relative canonical and Open Graph URL in the
 * app into an absolute one, and it is set from `SITE_URL` rather than written out
 * here, so the `www` host has exactly one home (`PLAN.md:84`).
 *
 * There is one Open Graph image for the site, not one per page and not one per
 * horse (`PLAN.md:78`). 6a shipped the file; 6b-ii only points at it.
 *
 * The landing page's title and description stay here because the landing page is
 * the site. The marketplace and each horse page set their own in their own
 * `metadata` export, which replaces this one wholesale rather than merging into
 * it — so nothing there inherits the site title by accident.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Evolution Stables — The Future of Ownership Has Arrived',
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: SITE_NAME,
    title: 'Evolution Stables — The Future of Ownership Has Arrived',
    description: SITE_DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistMono.variable} ${instrumentSerif.variable}`}>
      <body className="flex min-h-screen flex-col bg-canvas text-ink">
        <NavBar />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  )
}

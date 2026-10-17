import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import localFont from 'next/font/local'
import { Instrument_Serif } from 'next/font/google'
import './globals.css'

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

export const metadata: Metadata = {
  title: 'Evolution Stables — The Future of Ownership Has Arrived',
  description:
    'Digital syndication for thoroughbred ownership. Regulated, transparent, and built on the horse.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistMono.variable} ${instrumentSerif.variable}`}>
      <body>{children}</body>
    </html>
  )
}

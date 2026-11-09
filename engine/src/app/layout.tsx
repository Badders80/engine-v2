import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Fira_Code, Inter, Libre_Baskerville } from 'next/font/google'
import './globals.css'

import { OperatorNav } from './_components/OperatorNav'

// The three named roles from PLAN.md §3: Inter for UI, Fira Code for every
// number, date, id, hash and price, Libre Baskerville 400 for page titles.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const firaCode = Fira_Code({
  subsets: ['latin'],
  variable: '--font-fira-code',
  display: 'swap',
})

const libreBaskerville = Libre_Baskerville({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-libre-baskerville',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Engine V2 — engine',
  description: 'Operator surface for Engine V2.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${firaCode.variable} ${libreBaskerville.variable}`}
    >
      <body>
        <div className="grid min-h-screen grid-cols-1 md:grid-cols-[14rem_1fr]">
          <OperatorNav />
          <div className="min-w-0 p-4 md:p-8">
            <div className="mx-auto w-full max-w-console">{children}</div>
          </div>
        </div>
      </body>
    </html>
  )
}

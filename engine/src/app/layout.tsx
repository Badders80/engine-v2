import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

import { OperatorNav } from './_components/OperatorNav'

export const metadata: Metadata = {
  title: 'Engine V2 — engine',
  description: 'Operator surface for Engine V2.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="grid min-h-screen grid-cols-[14rem_1fr]">
          <OperatorNav />
          <div className="p-8">{children}</div>
        </div>
      </body>
    </html>
  )
}

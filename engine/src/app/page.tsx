import Link from 'next/link'

export default function Page() {
  return (
    <main>
      <h1>Engine V2 — engine</h1>
      <p>The operator surface. One screen: the DSL page.</p>
      <p>
        <Link href="/dsl/new">New DSL</Link>
      </p>
    </main>
  )
}

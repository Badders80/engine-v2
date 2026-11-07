import { recordStore } from '../records/store'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const rows = await recordStore().listHorses()

  return (
    <main>
      <h1 className="mb-6 text-2xl">Horses</h1>

      <table className="w-full max-w-3xl border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-black/20">
            <th className="py-2">Legal name</th>
            <th className="py-2">Slug</th>
            <th className="py-2">Images</th>
            <th className="py-2">Registered</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-black/10">
              <td className="py-2">{row.legalName}</td>
              <td className="py-2 font-mono text-xs">{row.slug}</td>
              <td className="py-2">{row.imageCount}</td>
              <td className="py-2">{row.registered ? 'yes' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 ? <p className="mt-6 opacity-70">No horses yet.</p> : null}
    </main>
  )
}

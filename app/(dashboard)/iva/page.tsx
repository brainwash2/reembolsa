export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function IvaPage() {
  const supabase = await createClient()
  const { data: claims } = await supabase.from('iva_claims').select(`
    *,
    shipments (reference, buyer)
  `)

  const stats = {
    draft: { count: 0, amount: 0 },
    ready: { count: 0, amount: 0 },
    filed: { count: 0, amount: 0 },
    approved: { count: 0, amount: 0 },
    paid: { count: 0, amount: 0 },
  }

  claims?.forEach(claim => {
    if (stats[claim.status as keyof typeof stats]) {
      stats[claim.status as keyof typeof stats].count++
      stats[claim.status as keyof typeof stats].amount += (claim.amount_clp || 0)
    }
  })

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">IVA Refund Tracker</h1>
        <p className="text-sm text-slate-500">Formulario 3600 — Track your export VAT refund claims with the SII</p>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {Object.entries(stats).map(([status, data]) => (
          <Card key={status}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase text-slate-500">{status}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold">{data.count} claims</p>
              <p className="text-sm text-slate-500">${data.amount.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="border rounded-lg bg-white overflow-hidden mt-8">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-6 py-3 font-medium text-slate-500">Shipment</th>
              <th className="px-6 py-3 font-medium text-slate-500">Buyer</th>
              <th className="px-6 py-3 font-medium text-slate-500">Amount (CLP)</th>
              <th className="px-6 py-3 font-medium text-slate-500">Status</th>
              <th className="px-6 py-3 font-medium text-slate-500">Missing docs</th>
            </tr>
          </thead>
          <tbody>
            {claims?.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No refund claims found.</td></tr>
            )}
            {claims?.map((claim: any) => (
              <tr key={claim.id} className="border-b last:border-0">
                <td className="px-6 py-4 font-medium">{claim.shipments?.reference || 'Unknown'}</td>
                <td className="px-6 py-4">{claim.shipments?.buyer || 'Unknown'}</td>
                <td className="px-6 py-4">${claim.amount_clp?.toLocaleString()}</td>
                <td className="px-6 py-4 capitalize">
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                    {claim.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {claim.missing_docs && claim.missing_docs.length > 0 ? (
                    <span className="text-red-500 text-xs font-medium">{claim.missing_docs.join(', ')}</span>
                  ) : (
                    <span className="text-emerald-600 text-xs font-medium">Complete</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { Button } from "@/components/ui/button"

export default async function ShipmentsPage() {
  const supabase = await createClient()
  const { data: shipments } = await supabase.from('shipments').select('*').order('created_at', { ascending: false })

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shipments</h1>
          <p className="text-sm text-slate-500">{shipments?.length || 0} export shipments tracked</p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700">+ New shipment</Button>
      </div>

      <div className="border rounded-lg bg-white overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-6 py-3 font-medium text-slate-500">Reference</th>
              <th className="px-6 py-3 font-medium text-slate-500">Buyer</th>
              <th className="px-6 py-3 font-medium text-slate-500">Destination</th>
              <th className="px-6 py-3 font-medium text-slate-500">Invoice</th>
              <th className="px-6 py-3 font-medium text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {shipments?.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No shipments found. Create your first one.</td></tr>
            )}
            {shipments?.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-6 py-4 font-medium">{s.reference}</td>
                <td className="px-6 py-4">{s.buyer}</td>
                <td className="px-6 py-4">{s.destination}</td>
                <td className="px-6 py-4">{s.currency} {s.invoice_amount?.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { createShipment } from '@/actions/shipments'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default async function ShipmentsPage() {
  const supabase = await createClient()
  const { data: shipments } = await supabase.from('shipments').select('*').order('created_at', { ascending: false })

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Shipments</h1>
        <p className="text-sm text-slate-500">{shipments?.length || 0} export shipments tracked</p>
      </div>

      {/* Formulaire de création rapide */}
      <div className="border rounded-lg bg-white p-6">
        <h3 className="font-bold mb-4 text-sm">Add a new export shipment</h3>
        <form action={createShipment} className="flex gap-2 items-end flex-wrap">
          <div className="space-y-1"><label className="text-xs font-medium text-slate-500">Reference</label><Input name="reference" placeholder="EXP-001" required /></div>
          <div className="space-y-1"><label className="text-xs font-medium text-slate-500">Buyer</label><Input name="buyer" placeholder="Company Name" required /></div>
          <div className="space-y-1"><label className="text-xs font-medium text-slate-500">Destination</label><Input name="destination" placeholder="Country" required /></div>
          <div className="space-y-1"><label className="text-xs font-medium text-slate-500">Amount</label><Input name="invoice_amount" type="number" step="0.01" placeholder="10000" required /></div>
          <div className="space-y-1"><label className="text-xs font-medium text-slate-500">Currency</label><Input name="currency" placeholder="USD" maxLength={3} required /></div>
          <Button type="submit" className="bg-teal-600 hover:bg-teal-700">Save</Button>
        </form>
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
              <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No shipments found. Create your first one above.</td></tr>
            )}
            {shipments?.map((s) => (
              <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50">
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

import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: shipments, error } = await supabase.from('shipments').select('*')
  
  if (error) console.error(error)

  const totalLockedCash = 56440000
  const pendingShipments = shipments?.filter(s => s.status === 'documents_pending').length || 0
  
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader><CardTitle>Locked Cash</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${totalLockedCash.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Shipments Pending</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{pendingShipments}</p></CardContent>
        </Card>
      </div>

      <div className="border rounded-lg mt-8">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-6 py-3">Reference</th>
              <th className="px-6 py-3">Buyer</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {shipments?.map((shipment) => (
              <tr key={shipment.id} className="border-b">
                <td className="px-6 py-4 font-medium">{shipment.reference}</td>
                <td className="px-6 py-4">{shipment.buyer}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-slate-100 rounded-full text-xs">{shipment.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: shipments } = await supabase.from('shipments').select('*')

  const pendingCount = shipments?.filter(s => s.status === 'documents_pending').length || 0
  const totalLockedCash = 56440000 // Plus tard, on calculera ça via la table iva_claims

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Overview of your IVA Exportador recovery pipeline</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Locked Cash</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${totalLockedCash.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Shipments Pending</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{pendingCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Total Shipments</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{shipments?.length || 0}</p></CardContent>
        </Card>
      </div>

      <div className="border rounded-lg bg-white p-6 mt-8">
        <h3 className="font-bold mb-4">Recent Shipments</h3>
        <div className="space-y-2">
           {shipments?.slice(0, 3).map(s => (
             <div key={s.id} className="flex justify-between p-3 border rounded text-sm">
               <span>{s.reference} - {s.buyer}</span>
               <span className="font-medium">{s.status}</span>
             </div>
           ))}
        </div>
      </div>
    </div>
  )
}

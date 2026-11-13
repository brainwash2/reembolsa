import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: shipments } = await supabase.from('shipments').select('*')
  const { data: claims } = await supabase.from('iva_claims').select('*').neq('status', 'paid')

  const pendingCount = shipments?.filter(s => s.status === 'documents_pending').length || 0
  const lockedCash = claims?.reduce((sum, claim) => sum + (claim.amount_clp || 0), 0) || 0

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Overview of your IVA Exportador recovery pipeline</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Locked Cash (CLP)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${lockedCash.toLocaleString()}</p></CardContent>
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
        {shipments?.length === 0 ? (
          <p className="text-sm text-slate-500">No shipments yet. Create one to get started.</p>
        ) : (
          <div className="space-y-2">
            {shipments?.slice(0, 5).map(s => (
              <div key={s.id} className="flex justify-between p-3 border rounded text-sm">
                <span>{s.reference} - {s.buyer}</span>
                <span className="font-medium capitalize">{s.status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

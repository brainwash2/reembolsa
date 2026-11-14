export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CashflowChart } from '@/components/cashflow-chart'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: shipments, error } = await supabase.from('shipments').select('*')
  const { data: claims } = await supabase.from('iva_claims').select('*').neq('status', 'paid')

  if (error) console.error(error)

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
          <CardContent><p className="text-3xl font-bold">${lockedCash.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Shipments Pending</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{pendingCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Total Shipments</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{shipments?.length || 0}</p></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Cash flow forecast (CLP millions)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
             <CashflowChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Shipments</CardTitle>
          </CardHeader>
          <CardContent>
            {shipments?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[200px] text-slate-500">
                <p>No shipments yet.</p>
              </div>
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

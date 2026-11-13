import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  let orgName = "My Company"
  if (user) {
    const { data: member } = await supabase
      .from('org_members')
      .select('organizations(name)')
      .eq('user_id', user.id)
      .single()
    if (member && member.organizations) {
      orgName = (member.organizations as any).name
    }
  }

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Manage your account and organization preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-500">Email Address</label>
            <p className="text-sm font-semibold text-slate-900">{user?.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-500">Organization Name</label>
            <p className="text-sm font-semibold text-slate-900">{orgName}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

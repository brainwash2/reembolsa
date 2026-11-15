export const dynamic = "force-dynamic"

import { requireOrg } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { NoOrgNotice } from "@/components/no-org-notice"

export default async function SettingsPage() {
  const org = await requireOrg()
  if (!org) return <NoOrgNotice />

  return (
    <div className="max-w-2xl space-y-6 p-8">
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
            <p className="text-sm font-semibold text-slate-900">{org.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-500">Organization Name</label>
            <p className="text-sm font-semibold text-slate-900">{org.orgName}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-500">Your role</label>
            <p className="text-sm font-semibold capitalize text-slate-900">{org.role}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

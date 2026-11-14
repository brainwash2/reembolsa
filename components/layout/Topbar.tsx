import { createClient } from '@/lib/supabase/server'
import { UserNav } from './UserNav'

export async function Topbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  let orgName = "My Company"
  let email = user?.email || ""

  if (user) {
    // On utilise limit(1).maybeSingle() au lieu de single() pour éviter le crash si plusieurs orgs
    const { data: member } = await supabase
      .from('org_members')
      .select('organizations(name)')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
      
    if (member && member.organizations) {
      orgName = (member.organizations as any).name
    }
  }

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-8">
      <div className="text-sm font-semibold text-slate-800">
        {orgName}
      </div>
      <UserNav orgName={orgName} email={email} />
    </header>
  )
}

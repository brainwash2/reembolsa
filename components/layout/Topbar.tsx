import { createClient } from '@/lib/supabase/server'
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export async function Topbar() {
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
    <header className="h-16 border-b bg-white flex items-center justify-between px-8">
      <div className="text-sm font-semibold text-slate-800">
        {orgName}
      </div>
      <Avatar className="h-8 w-8 bg-teal-600 text-white">
        <AvatarFallback>{orgName.substring(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
    </header>
  )
}

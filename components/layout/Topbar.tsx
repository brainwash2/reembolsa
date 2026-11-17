import { getCurrentOrg, getCurrentUser } from "@/lib/auth"
import { UserNav } from "./UserNav"
import { MobileNav } from "./Sidebar"

export async function Topbar() {
  const [user, org] = await Promise.all([getCurrentUser(), getCurrentOrg()])

  const email = user?.email ?? ""
  // Real organization name from the database. No fake fallback: say so if the membership is missing.
  const orgName = org?.orgName ?? "No organization"

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-white/95 px-4 backdrop-blur sm:h-16 sm:gap-3 sm:px-6 lg:px-8">
      <MobileNav />
      {/* min-w-0 + truncate: a long company name can never push the avatar off-screen */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-semibold text-slate-800">{orgName}</span>
        {org && (
          <span className="hidden shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600 min-[400px]:inline">
            {org.role}
          </span>
        )}
      </div>
      <UserNav orgName={orgName} email={email} />
    </header>
  )
}

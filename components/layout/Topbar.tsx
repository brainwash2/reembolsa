import { getCurrentOrg, getCurrentUser } from "@/lib/auth"
import { UserNav } from "./UserNav"

export async function Topbar() {
  const [user, org] = await Promise.all([getCurrentUser(), getCurrentOrg()])

  const email = user?.email ?? ""
  // Real organization name from the database. No fake "My Company" fallback:
  // if the membership is missing we say so.
  const orgName = org?.orgName ?? "No organization"

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-8">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800">{orgName}</span>
        {org && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
            {org.role}
          </span>
        )}
      </div>
      <UserNav orgName={orgName} email={email} />
    </header>
  )
}

import { Sidebar } from "@/components/layout/Sidebar"
import { Topbar } from "@/components/layout/Topbar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar (hidden below lg; mobile uses the Sheet menu inside the Topbar) */}
      <Sidebar />
      {/* min-w-0 is what lets wide tables scroll inside their own container instead of stretching the page */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}

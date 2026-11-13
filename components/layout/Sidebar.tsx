"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Package, Receipt } from "lucide-react"

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Shipments", href: "/shipments", icon: Package },
  { name: "IVA Refunds", href: "/iva", icon: Receipt },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col min-h-screen">
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <span className="text-xl font-bold text-teal-400">Reembolsa</span>
      </div>
      <nav className="flex-1 py-6 space-y-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.name} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${isActive ? "bg-slate-800 text-white" : "hover:bg-slate-800 hover:text-white"}`}>
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 text-xs text-slate-600 border-t border-slate-800">
        © 2026 Reembolsa
      </div>
    </aside>
  )
}

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Landmark, LayoutDashboard, Menu, Package, Receipt, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { name: "Cash flow", href: "/dashboard", icon: LayoutDashboard },
  { name: "Shipments", href: "/shipments", icon: Package },
  { name: "IVA Refunds", href: "/iva", icon: Receipt },
  { name: "Financing", href: "/financing", icon: Landmark },
  { name: "Settings", href: "/settings", icon: Settings },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Main" className="flex-1 space-y-1 px-3 py-6">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            // min-h-[44px] = 44px touch target
            className={cn(
              "flex min-h-[44px] items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
              isActive ? "bg-slate-800 text-white" : "hover:bg-slate-800 hover:text-white"
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" aria-hidden />
            {item.name}
          </Link>
        )
      })}
    </nav>
  )
}

/** Desktop sidebar: only from the lg breakpoint up. */
export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-slate-900 text-slate-300 lg:sticky lg:top-0 lg:flex lg:h-screen">
      <div className="flex h-16 items-center border-b border-slate-800 px-6">
        <span className="text-xl font-bold text-teal-400">Reembolsa</span>
      </div>
      <NavLinks />
      <div className="border-t border-slate-800 p-4 text-xs text-slate-500">© 2026 Reembolsa</div>
    </aside>
  )
}

/** Hamburger + slide-over navigation for < lg. Closes on navigation. */
export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="-ml-2 h-11 w-11 shrink-0 lg:hidden" aria-label="Open navigation menu">
          <Menu className="h-6 w-6" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex w-72 max-w-[85vw] flex-col gap-0 border-slate-800 bg-slate-900 p-0 text-slate-300 [&>button]:text-slate-400 [&>button]:hover:text-white"
      >
        <SheetHeader className="flex h-16 flex-row items-center border-b border-slate-800 px-6 text-left">
          <SheetTitle className="text-xl font-bold text-teal-400">Reembolsa</SheetTitle>
          <SheetDescription className="sr-only">Main navigation</SheetDescription>
        </SheetHeader>
        <NavLinks onNavigate={() => setOpen(false)} />
        <div className="border-t border-slate-800 p-4 text-xs text-slate-500">© 2026 Reembolsa</div>
      </SheetContent>
    </Sheet>
  )
}

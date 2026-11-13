"use client"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function Topbar() {
  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-8">
      <div className="text-sm font-medium text-slate-600">
        Exportadora Test SpA {/* On met un nom générique en attendant de le lier à l'Organization */}
      </div>
      <Avatar className="h-8 w-8 bg-teal-600 text-white">
        <AvatarFallback>VS</AvatarFallback>
      </Avatar>
    </header>
  )
}

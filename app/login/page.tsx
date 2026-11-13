"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else router.push("/dashboard")
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <form onSubmit={handleLogin} className="p-8 bg-white border rounded-xl shadow-sm w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-center mb-6">Welcome back</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700">Sign In</Button>
      </form>
    </div>
  )
}

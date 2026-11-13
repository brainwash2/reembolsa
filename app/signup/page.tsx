"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    // 1. Créer l'utilisateur (le trigger SQL va créer l'Organization automatiquement)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          company_name: companyName,
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      // 2. Rediriger vers le dashboard (ou login si la confirmation d'email est requise)
      router.push("/dashboard")
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <form onSubmit={handleSignup} className="p-8 bg-white border rounded-xl shadow-sm w-full max-w-md space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
          <p className="text-sm text-slate-500 mt-2">Start recovering your Export VAT today.</p>
        </div>
        
        {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded">{error}</p>}
        
        <Input type="text" placeholder="Company Name (e.g. Viña San Pedro)" value={companyName} onChange={e => setCompanyName(e.target.value)} required />
        <Input type="email" placeholder="Work Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        
        <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={loading}>
          {loading ? "Creating account..." : "Create Account"}
        </Button>

        <p className="text-center text-sm text-slate-500 mt-4">
          Already have an account? <Link href="/login" className="text-teal-600 hover:underline">Log in</Link>
        </p>
      </form>
    </div>
  )
}

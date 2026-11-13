import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ShieldCheck, Zap } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="flex items-center justify-between px-8 py-6 bg-white border-b">
        <div className="text-2xl font-bold text-teal-600">Reembolsa</div>
        <div className="space-x-4">
          <Link href="/login"><Button variant="ghost">Log in</Button></Link>
          <Link href="/signup"><Button className="bg-teal-600 hover:bg-teal-700">Get Started</Button></Link>
        </div>
      </header>

      <main>
        <section className="text-center py-24 px-4 max-w-4xl mx-auto">
          <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
            Stop waiting months for your Export VAT refund.
          </h1>
          <p className="text-xl text-slate-600 mb-10">
            Reembolsa automates the Formulario 3600 filing and tracks your IVA refund in real-time, so you get your working capital back faster.
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-lg px-8 py-6">
              Start recovering your cash
            </Button>
          </Link>
        </section>

        <section className="py-20 bg-white">
          <div className="max-w-6xl mx-auto grid grid-cols-3 gap-8 px-4">
            <div className="text-center p-6 border rounded-xl shadow-sm">
              <Zap className="w-12 h-12 text-teal-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">AI Document Check</h3>
              <p className="text-slate-600">Upload your DUS and invoice. Our AI catches errors before the SII does.</p>
            </div>
            <div className="text-center p-6 border rounded-xl shadow-sm">
              <CheckCircle2 className="w-12 h-12 text-teal-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Auto-Filing</h3>
              <p className="text-slate-600">Generate the perfect Formulario 3600 package in one click.</p>
            </div>
            <div className="text-center p-6 border rounded-xl shadow-sm">
              <ShieldCheck className="w-12 h-12 text-teal-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Cash Flow Tracker</h3>
              <p className="text-slate-600">Know exactly when your refund will hit your bank account.</p>
            </div>
          </div>
        </section>

        <section className="py-20 text-center">
          <h2 className="text-3xl font-bold mb-12">Simple, transparent pricing</h2>
          <div className="max-w-4xl mx-auto grid grid-cols-3 gap-6 px-4">
            <div className="border p-8 rounded-xl bg-white">
              <h3 className="text-lg font-bold text-slate-500">Starter</h3>
              <div className="text-4xl font-extrabold my-4">$0<span className="text-lg text-slate-500 font-normal">/mo</span></div>
              <p className="text-sm text-slate-500 mb-6">Up to 2 shipments per month.</p>
              <Button variant="outline" className="w-full">Start Free</Button>
            </div>
            <div className="border-2 border-teal-500 p-8 rounded-xl bg-white relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-teal-500 text-white px-3 py-1 rounded-full text-xs font-bold">MOST POPULAR</div>
              <h3 className="text-lg font-bold text-teal-600">Pro</h3>
              <div className="text-4xl font-extrabold my-4">$29<span className="text-lg text-slate-500 font-normal">/mo</span></div>
              <p className="text-sm text-slate-500 mb-6">Unlimited shipments, AI check & tracker.</p>
              <Link href="/signup"><Button className="w-full bg-teal-600 hover:bg-teal-700">Start 14-day trial</Button></Link>
            </div>
            <div className="border p-8 rounded-xl bg-white">
              <h3 className="text-lg font-bold text-slate-500">Enterprise</h3>
              <div className="text-4xl font-extrabold my-4">Custom</div>
              <p className="text-sm text-slate-500 mb-6">For accounting firms managing multiple clients.</p>
              <Button variant="outline" className="w-full">Contact Sales</Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

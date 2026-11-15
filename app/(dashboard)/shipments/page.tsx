export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { requireOrg } from "@/lib/auth"
import { createShipment } from "@/actions/shipments"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NoOrgNotice, LoadError } from "@/components/no-org-notice"

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const org = await requireOrg()
  if (!org) return <NoOrgNotice />

  const { error: formError } = await searchParams
  const supabase = await createClient()
  const { data: shipments, error } = await supabase
    .from("shipments")
    .select("id, reference, buyer, destination, currency, invoice_amount, status")
    .eq("org_id", org.orgId)
    .order("created_at", { ascending: false })

  if (error) console.error("[shipments]", error)
  const rows = shipments ?? []
  const canWrite = org.role !== "viewer"

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Shipments</h1>
        <p className="text-sm text-slate-500">{rows.length} export shipments tracked</p>
      </div>

      {error && <LoadError what="shipments" />}
      {formError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {formError}
        </p>
      )}

      {canWrite && (
        <div className="rounded-lg border bg-white p-6">
          <h3 className="mb-4 text-sm font-bold">Add a new export shipment</h3>
          <form action={createShipment} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Reference</label>
              <Input name="reference" placeholder="EXP-001" required maxLength={60} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Buyer</label>
              <Input name="buyer" placeholder="Company Name" required maxLength={200} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Destination</label>
              <Input name="destination" placeholder="Country" required maxLength={100} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Invoice amount</label>
              <Input name="invoice_amount" type="number" step="0.01" min="0.01" placeholder="10000" required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Currency</label>
              <Input name="currency" placeholder="USD" maxLength={3} minLength={3} required className="uppercase" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">IVA crédito fiscal (CLP)</label>
              <Input name="input_vat_local" type="number" step="1" min="0" placeholder="7940000" />
            </div>
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
              Save
            </Button>
          </form>
          <p className="mt-3 text-xs text-slate-400">
            The refund amount is the input VAT you paid on purchases tied to this export - not 19% of the invoice.
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-6 py-3 font-medium text-slate-500">Reference</th>
              <th className="px-6 py-3 font-medium text-slate-500">Buyer</th>
              <th className="px-6 py-3 font-medium text-slate-500">Destination</th>
              <th className="px-6 py-3 font-medium text-slate-500">Invoice</th>
              <th className="px-6 py-3 font-medium text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  No shipments found. Create your first one above.
                </td>
              </tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="px-6 py-4 font-medium">{s.reference}</td>
                <td className="px-6 py-4">{s.buyer}</td>
                <td className="px-6 py-4">{s.destination}</td>
                <td className="px-6 py-4 tabular-nums">
                  {s.currency} {Number(s.invoice_amount).toLocaleString("en-US")}
                </td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                    {String(s.status).replaceAll("_", " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

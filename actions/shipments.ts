"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireOrg } from "@/lib/auth"

const CreateShipmentSchema = z.object({
  reference: z.string().trim().min(1, "Reference is required").max(60),
  buyer: z.string().trim().min(1, "Buyer is required").max(200),
  destination: z.string().trim().min(2, "Destination is required").max(100),
  invoice_amount: z.coerce.number().finite().positive("Amount must be greater than 0").max(1_000_000_000),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code (USD, EUR…)"),
  // IVA crédito fiscal tied to this export, in local currency (CLP). Blank = 0.
  input_vat_local: z.coerce.number().int("Input VAT must be a whole number").min(0).max(100_000_000_000),
})

function fail(message: string): never {
  // redirect() throws NEXT_REDIRECT - must never be called inside try/catch.
  redirect(`/shipments?error=${encodeURIComponent(message)}`)
}

export async function createShipment(formData: FormData) {
  // Identity + tenant come from the session on the SERVER. org_id / user_id from
  // the form are ignored; RLS re-checks everything below.
  const org = await requireOrg()
  if (!org) fail("Your account has no organization yet.")
  if (org.role === "viewer") fail("Your role (viewer) cannot create shipments.")

  const parsed = CreateShipmentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    fail(`${issue.path.join(".") || "form"}: ${issue.message}`)
  }

  const supabase = await createClient()
  const { error } = await supabase.from("shipments").insert({
    org_id: org.orgId,
    ...parsed.data, // user_id defaults to auth.uid() in the database
    status: "draft",
  })

  if (error) {
    console.error("[createShipment]", error.code, error.message) // detail stays in server logs
    if (error.code === "23505") fail("A shipment with that reference already exists.")
    if (error.code === "42501") fail("You do not have permission to create shipments.")
    fail("Could not save the shipment. Please try again.")
  }

  // The DB trigger also created the draft IVA claim, so refresh every view that reads it.
  revalidatePath("/shipments")
  revalidatePath("/dashboard")
  revalidatePath("/iva")
  redirect("/shipments")
}

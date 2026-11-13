"use server"

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createShipment(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Récupérer l'organisation de l'utilisateur
  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!member) throw new Error("No organization found")

  const reference = formData.get('reference') as string
  const buyer = formData.get('buyer') as string
  const destination = formData.get('destination') as string
  const invoice_amount = parseFloat(formData.get('invoice_amount') as string)
  const currency = formData.get('currency') as string

  const { error } = await supabase.from('shipments').insert({
    org_id: member.org_id,
    user_id: user.id,
    reference,
    buyer,
    destination,
    invoice_amount,
    currency,
    status: 'draft'
  })

  if (error) {
    console.error(error)
    throw new Error(error.message)
  }

  revalidatePath('/shipments')
  revalidatePath('/dashboard')
}

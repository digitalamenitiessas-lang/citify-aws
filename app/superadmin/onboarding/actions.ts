'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireProfile } from '@/lib/auth'
import { updateOnboardingRequestStatusInPostgres } from '@/lib/db/onboarding'

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'contacted', 'qualified', 'converted', 'dismissed']),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export async function updateOnboardingRequestAction(input: z.input<typeof updateSchema>) {
  const parsed = updateSchema.parse(input)
  const { profile } = await requireProfile(['super_admin'])

  await updateOnboardingRequestStatusInPostgres({
    id: parsed.id,
    status: parsed.status,
    notes: parsed.notes ?? null,
    actorProfileId: profile.id,
  })

  revalidatePath('/superadmin/onboarding')
  return { ok: true }
}

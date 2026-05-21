'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireProfile } from '@/lib/auth'
import { pgQuery } from '@/lib/db/postgres'

const preferencesSchema = z.object({
  complaints: z.boolean(),
  liquidations: z.boolean(),
  announcements: z.boolean(),
  promotions: z.boolean(),
})

export type EmailPreferences = z.infer<typeof preferencesSchema>

export async function getEmailPreferencesAction(): Promise<EmailPreferences> {
  const { profile } = await requireProfile()
  const res = await pgQuery<{ email_notifications: Record<string, boolean> }>(
    `select email_notifications from public.profiles where id = $1 limit 1`,
    [profile.id],
  )
  const stored = res.rows[0]?.email_notifications ?? {}
  return preferencesSchema.parse({
    complaints: stored.complaints ?? true,
    liquidations: stored.liquidations ?? true,
    announcements: stored.announcements ?? true,
    promotions: stored.promotions ?? false,
  })
}

export async function updateEmailPreferencesAction(input: EmailPreferences) {
  const { profile } = await requireProfile()
  const parsed = preferencesSchema.parse(input)
  await pgQuery(
    `update public.profiles
        set email_notifications = $2::jsonb
      where id = $1`,
    [profile.id, JSON.stringify(parsed)],
  )
  revalidatePath('/configuracion')
  return { ok: true }
}

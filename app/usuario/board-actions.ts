'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireProfile } from '@/lib/auth'
import { BOARD_POST_MAX_LENGTH, BOARD_POSTS_PER_DAY } from '@/lib/board'
import { resolveVecinoBuildingId } from '@/lib/board-access'
import {
  countRecentBoardPostsByAuthor,
  getBoardPostMeta,
  insertBoardPost,
  softDeleteOwnBoardPost,
  toggleBoardSupport,
} from '@/lib/db/board'
import { pushBoardPostCreated } from '@/lib/push/events'

// Pizarra de quejas, del lado del vecino. Devuelven { ok, error } en lugar de
// tirar: en produccion Next reemplaza el mensaje de un error tirado por uno
// generico, y el vecino tiene que leer el motivo real.

type Result = { ok: true } | { ok: false; error: string }

const createSchema = z.object({
  body: z.string().trim().min(3, 'Escribí al menos unas palabras.').max(BOARD_POST_MAX_LENGTH),
  isAnonymous: z.boolean(),
})

export async function createBoardPostAction(input: z.input<typeof createSchema>): Promise<Result> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisá el texto.' }

  const { profile } = await requireProfile(['vecino'])
  const buildingId = await resolveVecinoBuildingId(profile)
  if (!buildingId) return { ok: false, error: 'Tu cuenta no está vinculada a ningún edificio todavía.' }

  if ((await countRecentBoardPostsByAuthor(profile.id)) >= BOARD_POSTS_PER_DAY) {
    return { ok: false, error: `Llegaste al máximo de ${BOARD_POSTS_PER_DAY} quejas por día. Probá mañana.` }
  }

  const postId = await insertBoardPost({
    buildingId,
    authorProfileId: profile.id,
    body: parsed.data.body,
    isAnonymous: parsed.data.isAnonymous,
  })

  const meta = await getBoardPostMeta(postId)
  if (meta) {
    // No bloquea: pushBoardPostCreated nunca tira.
    void pushBoardPostCreated({
      postId,
      buildingId,
      buildingName: meta.buildingName,
      body: parsed.data.body,
      authorLabel: parsed.data.isAnonymous ? 'Vecino anónimo' : profile.fullName || 'Vecino',
    })
  }

  revalidatePath('/usuario')
  return { ok: true }
}

const postIdSchema = z.object({ postId: z.string().uuid() })

/** "Me pasa lo mismo": solo en quejas visibles de su edificio, y no en las propias. */
export async function toggleBoardSupportAction(input: z.input<typeof postIdSchema>): Promise<Result & { supported?: boolean }> {
  const parsed = postIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Queja inválida.' }

  const { profile } = await requireProfile(['vecino'])
  const [buildingId, meta] = await Promise.all([
    resolveVecinoBuildingId(profile),
    getBoardPostMeta(parsed.data.postId),
  ])
  if (!meta || meta.hidden || meta.buildingId !== buildingId) {
    return { ok: false, error: 'Esa queja ya no está en la pizarra.' }
  }
  if (meta.authorProfileId === profile.id) {
    return { ok: false, error: 'No podés sumarte a tu propia queja.' }
  }

  const supported = await toggleBoardSupport(parsed.data.postId, profile.id)
  revalidatePath('/usuario')
  return { ok: true, supported }
}

export async function deleteBoardPostAction(input: z.input<typeof postIdSchema>): Promise<Result> {
  const parsed = postIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Queja inválida.' }

  const { profile } = await requireProfile(['vecino'])
  const deleted = await softDeleteOwnBoardPost(parsed.data.postId, profile.id)
  if (!deleted) return { ok: false, error: 'Solo podés borrar tus propias quejas.' }

  revalidatePath('/usuario')
  return { ok: true }
}

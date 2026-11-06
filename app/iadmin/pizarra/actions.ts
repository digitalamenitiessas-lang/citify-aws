'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireIAdmin } from '@/lib/auth'
import { BOARD_POST_MAX_LENGTH } from '@/lib/board'
import { adminCanManageBuilding } from '@/lib/board-access'
import {
  getBoardPostMeta,
  getBoardSupporterIds,
  insertBoardReply,
  setBoardPostHidden,
  updateBoardPostStatus,
} from '@/lib/db/board'
import { pushBoardPostReplied, pushBoardPostStatusChanged } from '@/lib/push/events'

// Pizarra de quejas, del lado de la administracion: responder en publico,
// cambiar el estado y ocultar. Devuelven { ok, error } (ver
// app/usuario/board-actions.ts).

type Result = { ok: true } | { ok: false; error: string }

/** La queja, si existe y es de un edificio que administra quien llama. */
async function loadManagedPost(postId: string) {
  const { profile, context } = await requireIAdmin({ capability: 'consorcio.view' })
  const meta = await getBoardPostMeta(postId)
  if (!meta || !(await adminCanManageBuilding(context, meta.buildingId))) return null
  return { profile, meta }
}

function refresh() {
  revalidatePath('/iadmin/pizarra')
  revalidatePath('/iadmin')
  revalidatePath('/usuario')
}

const replySchema = z.object({
  postId: z.string().uuid(),
  body: z.string().trim().min(2, 'Escribí la respuesta.').max(BOARD_POST_MAX_LENGTH),
})

export async function replyBoardPostAction(input: z.input<typeof replySchema>): Promise<Result> {
  const parsed = replySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisá la respuesta.' }

  const loaded = await loadManagedPost(parsed.data.postId)
  if (!loaded) return { ok: false, error: 'Esa queja ya no existe o no es de tus edificios.' }

  await insertBoardReply({
    postId: parsed.data.postId,
    authorProfileId: loaded.profile.id,
    body: parsed.data.body,
  })

  // Responder es empezar a ocuparse: una queja recien recibida pasa a "en
  // curso" sola, para que el admin no tenga que hacer dos pasos.
  if (loaded.meta.status === 'recibida') {
    await updateBoardPostStatus(parsed.data.postId, 'en_curso')
  }

  void pushBoardPostReplied({
    postId: parsed.data.postId,
    authorProfileId: loaded.meta.authorProfileId,
    buildingName: loaded.meta.buildingName,
    reply: parsed.data.body,
  })

  refresh()
  return { ok: true }
}

const statusSchema = z.object({
  postId: z.string().uuid(),
  status: z.enum(['recibida', 'en_curso', 'resuelta']),
})

export async function setBoardPostStatusAction(input: z.input<typeof statusSchema>): Promise<Result> {
  const parsed = statusSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Estado inválido.' }

  const loaded = await loadManagedPost(parsed.data.postId)
  if (!loaded) return { ok: false, error: 'Esa queja ya no existe o no es de tus edificios.' }

  const { status } = parsed.data
  if (status === loaded.meta.status) return { ok: true }

  await updateBoardPostStatus(parsed.data.postId, status)

  void (async () => {
    await pushBoardPostStatusChanged({
      postId: parsed.data.postId,
      authorProfileId: loaded.meta.authorProfileId,
      supporterIds: status === 'resuelta' ? await getBoardSupporterIds(parsed.data.postId) : [],
      buildingName: loaded.meta.buildingName,
      body: loaded.meta.body,
      status,
    })
  })().catch((err) => console.error('[push] estado de queja: fallo (no bloquea)', err))

  refresh()
  return { ok: true }
}

const hiddenSchema = z.object({
  postId: z.string().uuid(),
  hidden: z.boolean(),
})

/** Ocultar una queja ofensiva: deja de verse en la pizarra de los vecinos (el autor la sigue viendo, marcada). */
export async function setBoardPostHiddenAction(input: z.input<typeof hiddenSchema>): Promise<Result> {
  const parsed = hiddenSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Pedido inválido.' }

  const loaded = await loadManagedPost(parsed.data.postId)
  if (!loaded) return { ok: false, error: 'Esa queja ya no existe o no es de tus edificios.' }

  await setBoardPostHidden(parsed.data.postId, parsed.data.hidden, loaded.profile.id)
  refresh()
  return { ok: true }
}

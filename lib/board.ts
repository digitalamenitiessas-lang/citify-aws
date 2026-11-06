// Tipos y textos de la Pizarra de quejas que comparten el servidor y el
// navegador. Nada de base aca: las consultas viven en lib/db/board.ts.

export type BoardPostStatus = 'recibida' | 'en_curso' | 'resuelta'

export const BOARD_POST_STATUSES: ReadonlyArray<BoardPostStatus> = ['recibida', 'en_curso', 'resuelta']

export const BOARD_STATUS_LABEL: Record<BoardPostStatus, string> = {
  recibida: 'Recibida',
  en_curso: 'En curso',
  resuelta: 'Resuelta',
}

export const BOARD_POST_MAX_LENGTH = 1000

/** Cuantas quejas puede publicar un vecino en 24 horas. */
export const BOARD_POSTS_PER_DAY = 10

export interface BoardReply {
  id: string
  body: string
  createdAt: string
}

export interface BoardPost {
  id: string
  buildingId: string
  buildingName: string
  body: string
  status: BoardPostStatus
  isAnonymous: boolean
  /** Nombre del autor; null si es anonima. */
  authorName: string | null
  /** Unidad del autor; null si es anonima o no tiene. */
  authorUnit: string | null
  supportCount: number
  /** Solo tiene sentido para el vecino que mira. */
  supportedByMe: boolean
  isMine: boolean
  hidden: boolean
  createdAt: string
  replies: BoardReply[]
}

/** "Vecino anónimo" o "Juana Pérez · 12B". */
export function boardAuthorLabel(post: Pick<BoardPost, 'authorName' | 'authorUnit'>): string {
  if (!post.authorName) return 'Vecino anónimo'
  return post.authorUnit ? `${post.authorName} · ${post.authorUnit}` : post.authorName
}

'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Eye, EyeOff, HandHeart, Send, StickyNote } from 'lucide-react'
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/textarea'
import {
  replyBoardPostAction,
  setBoardPostHiddenAction,
  setBoardPostStatusAction,
} from '@/app/iadmin/pizarra/actions'
import {
  BOARD_POST_MAX_LENGTH,
  BOARD_POST_STATUSES,
  BOARD_STATUS_LABEL,
  boardAuthorLabel,
  type BoardPost,
  type BoardPostStatus,
} from '@/lib/board'
import { BoardReplies, BoardStatusBadge, timeAgo } from './board-shared'

type Filter = 'abiertas' | 'resueltas' | 'ocultas' | 'todas'
type Sort = 'recientes' | 'apoyadas'

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'abiertas', label: 'Sin resolver' },
  { key: 'resueltas', label: 'Resueltas' },
  { key: 'ocultas', label: 'Ocultas' },
  { key: 'todas', label: 'Todas' },
]

function matches(post: BoardPost, filter: Filter): boolean {
  switch (filter) {
    case 'abiertas':
      return !post.hidden && post.status !== 'resuelta'
    case 'resueltas':
      return !post.hidden && post.status === 'resuelta'
    case 'ocultas':
      return post.hidden
    default:
      return true
  }
}

interface Props {
  posts: BoardPost[]
  /** Con varios edificios a la vista, cada queja dice de cual es. */
  showBuilding: boolean
  focusedId: string | null
}

export function AdminBoardPanel({ posts, showBuilding, focusedId }: Props) {
  // Si llega desde una notificacion, arrancar en el filtro donde esta esa queja.
  const [filter, setFilter] = useState<Filter>(() => {
    const focused = focusedId ? posts.find((p) => p.id === focusedId) : null
    return focused ? (FILTERS.find((f) => matches(focused, f.key))?.key ?? 'todas') : 'abiertas'
  })
  const [sort, setSort] = useState<Sort>('recientes')
  const focusedRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    focusedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusedId])

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, posts.filter((p) => matches(p, f.key)).length])) as Record<Filter, number>,
    [posts],
  )

  const visible = useMemo(() => {
    const list = posts.filter((p) => matches(p, filter))
    if (sort === 'apoyadas') {
      return [...list].sort((a, b) => b.supportCount - a.supportCount || b.createdAt.localeCompare(a.createdAt))
    }
    return list
  }, [posts, filter, sort])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === f.key
                  ? 'bg-[var(--citify-terracotta)] text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label} · {counts[f.key]}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
          aria-label="Ordenar"
        >
          <option value="recientes">Más recientes</option>
          <option value="apoyadas">Más vecinos sumados</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="glass-card rounded-2xl px-5 py-12 text-center">
          <StickyNote className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {posts.length === 0
              ? 'Todavía nadie escribió en la pizarra. Cuando un vecino publique una queja, te llega un aviso y la ves acá.'
              : 'No hay quejas en este filtro.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((post) => (
            <div key={post.id} ref={post.id === focusedId ? focusedRef : undefined}>
              <AdminPostCard post={post} showBuilding={showBuilding} focused={post.id === focusedId} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AdminPostCard({
  post,
  showBuilding,
  focused,
}: {
  post: BoardPost
  showBuilding: boolean
  focused: boolean
}) {
  const router = useRouter()
  const [reply, setReply] = useState('')
  const [isPending, startTransition] = useTransition()

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, success?: string, after?: () => void) {
    startTransition(async () => {
      const res = await action()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      if (success) toast.success(success)
      after?.()
      router.refresh()
    })
  }

  function changeStatus(status: BoardPostStatus) {
    if (status === post.status) return
    run(() => setBoardPostStatusAction({ postId: post.id, status }), `Marcada como ${BOARD_STATUS_LABEL[status].toLowerCase()}.`)
  }

  function sendReply() {
    run(
      () => replyBoardPostAction({ postId: post.id, body: reply }),
      'Respuesta publicada.',
      () => setReply(''),
    )
  }

  function toggleHidden() {
    if (!post.hidden && !window.confirm('¿Ocultar esta queja? Los vecinos dejan de verla; quien la escribió la sigue viendo, marcada como oculta.')) {
      return
    }
    run(
      () => setBoardPostHiddenAction({ postId: post.id, hidden: !post.hidden }),
      post.hidden ? 'La queja volvió a la pizarra.' : 'Queja oculta.',
    )
  }

  return (
    <article
      className={`glass-card flex h-full flex-col rounded-2xl border p-4 ${
        focused ? 'border-[var(--citify-terracotta)]' : 'border-border/40'
      } ${post.hidden ? 'opacity-75' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-semibold text-foreground">{boardAuthorLabel(post)}</span>
        <span className="text-xs text-muted-foreground">{timeAgo(post.createdAt)}</span>
        <span className="ml-auto">
          <BoardStatusBadge status={post.status} />
        </span>
      </div>
      {showBuilding ? (
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3" />
          {post.buildingName}
        </div>
      ) : null}
      {post.hidden ? (
        <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">Oculta: los vecinos no la ven.</p>
      ) : null}

      <p className="mt-2 whitespace-pre-line text-sm text-foreground">{post.body}</p>

      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <HandHeart className="h-3.5 w-3.5" />
        {post.supportCount === 0
          ? 'Ningún vecino se sumó todavía'
          : `${post.supportCount} ${post.supportCount === 1 ? 'vecino dice' : 'vecinos dicen'} que les pasa lo mismo`}
      </div>

      <BoardReplies replies={post.replies} />

      <div className="mt-auto pt-3">
        <Textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          maxLength={BOARD_POST_MAX_LENGTH}
          rows={2}
          placeholder="Responder en la pizarra (lo ven todos los vecinos)"
          className="resize-none text-sm"
          disabled={isPending}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-border" role="radiogroup" aria-label="Estado">
            {BOARD_POST_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                role="radio"
                aria-checked={post.status === status}
                onClick={() => changeStatus(status)}
                disabled={isPending}
                className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  post.status === status
                    ? 'bg-[var(--citify-terracotta)] text-white'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                }`}
              >
                {BOARD_STATUS_LABEL[status]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={toggleHidden}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            {post.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {post.hidden ? 'Mostrar' : 'Ocultar'}
          </button>
          <button
            type="button"
            onClick={sendReply}
            disabled={isPending || reply.trim().length < 2}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[var(--citify-terracotta)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            Responder
          </button>
        </div>
      </div>
    </article>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, EyeOff, HandHeart, StickyNote, Trash2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/textarea'
import {
  createBoardPostAction,
  deleteBoardPostAction,
  toggleBoardSupportAction,
} from '@/app/usuario/board-actions'
import { BOARD_POST_MAX_LENGTH, boardAuthorLabel, type BoardPost } from '@/lib/board'
import { BoardReplies, BoardStatusBadge, timeAgo } from './board-shared'

type Filter = 'todas' | 'abiertas' | 'resueltas' | 'mias'

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'todas', label: 'Todas' },
  { key: 'abiertas', label: 'Sin resolver' },
  { key: 'resueltas', label: 'Resueltas' },
  { key: 'mias', label: 'Mías' },
]

interface Props {
  posts: BoardPost[]
  buildingName: string
  onBack: () => void
  /** ?id=... en la URL (llega desde una notificacion): se resalta esa queja. */
  focusedId?: string | null
}

export function NeighborBoardPanel({ posts, buildingName, onBack, focusedId }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('todas')
  const [body, setBody] = useState('')
  const [anonymous, setAnonymous] = useState(true)
  const [isPublishing, startPublish] = useTransition()
  const focusedRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    focusedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusedId])

  const visible = useMemo(() => {
    switch (filter) {
      case 'abiertas':
        return posts.filter((p) => p.status !== 'resuelta')
      case 'resueltas':
        return posts.filter((p) => p.status === 'resuelta')
      case 'mias':
        return posts.filter((p) => p.isMine)
      default:
        return posts
    }
  }, [posts, filter])

  function publish() {
    startPublish(async () => {
      const res = await createBoardPostAction({ body, isAnonymous: anonymous })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setBody('')
      setFilter('todas')
      toast.success('Tu queja ya está en la pizarra.')
      router.refresh()
    })
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <h2 className="text-lg font-bold text-foreground">Pizarra de {buildingName}</h2>
      </div>

      {/* Publicar */}
      <div className="glass-card mb-5 rounded-2xl p-4">
        <p className="text-sm font-semibold text-foreground">¿Algo que mejorar en el edificio?</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Lo ven todos los vecinos y la administración, que te responde acá.
        </p>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={BOARD_POST_MAX_LENGTH}
          rows={3}
          placeholder="Ej: la luz del pasillo del bloque B está quemada desde el lunes."
          className="mt-3 resize-none"
        />

        <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Cómo publicar">
          <AuthorOption
            active={anonymous}
            onClick={() => setAnonymous(true)}
            icon={EyeOff}
            title="Anónima"
            hint="Nadie ve quién la escribió, tampoco la administración."
          />
          <AuthorOption
            active={!anonymous}
            onClick={() => setAnonymous(false)}
            icon={UserRound}
            title="Con mi nombre"
            hint="Se ve tu nombre y tu unidad."
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground">
            {body.length}/{BOARD_POST_MAX_LENGTH}
          </span>
          <button
            type="button"
            onClick={publish}
            disabled={isPublishing || body.trim().length < 3}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--citify-terracotta)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <StickyNote className="h-4 w-4" />
            {isPublishing ? 'Publicando…' : 'Publicar en la pizarra'}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
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
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="glass-card rounded-2xl px-5 py-12 text-center">
          <StickyNote className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {posts.length === 0
              ? 'La pizarra está vacía. Si algo te molesta, sé el primero en contarlo.'
              : 'No hay quejas con este filtro.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((post) => (
            <div key={post.id} ref={post.id === focusedId ? focusedRef : undefined}>
              <NeighborPostCard post={post} focused={post.id === focusedId} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AuthorOption({
  active,
  onClick,
  icon: Icon,
  title,
  hint,
}: {
  active: boolean
  onClick: () => void
  icon: typeof EyeOff
  title: string
  hint: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`rounded-xl border p-2.5 text-left transition-colors ${
        active
          ? 'border-[var(--citify-terracotta)] bg-[color-mix(in_srgb,var(--citify-blush)_35%,transparent)] dark:border-[var(--citify-terracotta)] dark:bg-[color-mix(in_srgb,var(--citify-blush)_10%,transparent)]'
          : 'border-border hover:bg-muted/50'
      }`}
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4" />
        {title}
      </span>
      <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{hint}</span>
    </button>
  )
}

function NeighborPostCard({ post, focused }: { post: BoardPost; focused: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function toggleSupport() {
    startTransition(async () => {
      const res = await toggleBoardSupportAction({ postId: post.id })
      if (!res.ok) toast.error(res.error)
      else router.refresh()
    })
  }

  function remove() {
    if (!window.confirm('¿Borrar tu queja de la pizarra?')) return
    startTransition(async () => {
      const res = await deleteBoardPostAction({ postId: post.id })
      if (!res.ok) toast.error(res.error)
      else {
        toast.success('Queja borrada.')
        router.refresh()
      }
    })
  }

  return (
    <article
      className={`glass-card rounded-2xl border p-4 ${
        focused ? 'border-[var(--citify-terracotta)]' : 'border-border/40'
      } ${post.hidden ? 'opacity-70' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-semibold text-foreground">{boardAuthorLabel(post)}</span>
        {post.isMine ? (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Tuya
          </span>
        ) : null}
        <span className="text-xs text-muted-foreground">{timeAgo(post.createdAt)}</span>
        <span className="ml-auto">
          <BoardStatusBadge status={post.status} />
        </span>
      </div>

      {post.hidden ? (
        <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
          La administración la ocultó: los demás vecinos no la ven.
        </p>
      ) : null}

      <p className="mt-2 whitespace-pre-line text-sm text-foreground">{post.body}</p>

      <BoardReplies replies={post.replies} />

      <div className="mt-3 flex items-center justify-between gap-2">
        {post.isMine ? (
          <span className="text-xs text-muted-foreground">
            {post.supportCount === 0
              ? 'Todavía nadie se sumó'
              : `${post.supportCount} ${post.supportCount === 1 ? 'vecino se sumó' : 'vecinos se sumaron'}`}
          </span>
        ) : (
          <button
            type="button"
            onClick={toggleSupport}
            disabled={isPending || post.hidden}
            aria-pressed={post.supportedByMe}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
              post.supportedByMe
                ? 'bg-[var(--citify-terracotta)] text-white'
                : 'bg-muted text-foreground hover:bg-muted/70'
            }`}
          >
            <HandHeart className="h-3.5 w-3.5" />
            Me pasa lo mismo{post.supportCount > 0 ? ` · ${post.supportCount}` : ''}
          </button>
        )}
        {post.isMine ? (
          <button
            type="button"
            onClick={remove}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Borrar
          </button>
        ) : null}
      </div>
    </article>
  )
}

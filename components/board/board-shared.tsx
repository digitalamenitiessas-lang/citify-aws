import { Building2, CheckCircle2, Clock3, Inbox } from 'lucide-react'
import { BRAND_CHIP, TONE } from '@/components/admin-backoffice/shared/brand'
import { BOARD_STATUS_LABEL, type BoardPostStatus, type BoardReply } from '@/lib/board'

// Piezas que comparten la pizarra del vecino y la del administrador.

const STATUS_STYLE: Record<BoardPostStatus, { chip: string; icon: typeof Inbox }> = {
  recibida: { chip: BRAND_CHIP, icon: Inbox },
  en_curso: { chip: TONE.warning.chip, icon: Clock3 },
  resuelta: { chip: TONE.success.chip, icon: CheckCircle2 },
}

export function BoardStatusBadge({ status }: { status: BoardPostStatus }) {
  const { chip, icon: Icon } = STATUS_STYLE[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip}`}>
      <Icon className="h-3 w-3" />
      {BOARD_STATUS_LABEL[status]}
    </span>
  )
}

/** Respuestas de la administracion, debajo de la queja. */
export function BoardReplies({ replies }: { replies: BoardReply[] }) {
  if (replies.length === 0) return null
  return (
    <div className="mt-3 space-y-2">
      {replies.map((reply) => (
        <div
          key={reply.id}
          className="rounded-xl border-l-4 border-[var(--citify-terracotta)] bg-muted/50 px-3 py-2 dark:border-[var(--citify-terracotta)]"
        >
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
            <Building2 className="h-3 w-3" />
            Respuesta de la administración
            <span className="font-normal text-muted-foreground">· {timeAgo(reply.createdAt)}</span>
          </div>
          <p className="mt-1 whitespace-pre-line text-sm text-foreground">{reply.body}</p>
        </div>
      ))}
    </div>
  )
}

export function timeAgo(iso: string): string {
  const date = new Date(iso)
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (diffMin < 1) return 'hace un instante'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `hace ${diffH} h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `hace ${diffD} d`
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

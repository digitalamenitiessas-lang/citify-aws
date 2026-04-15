'use client'

import { Promotion } from '@/lib/mock-data'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Tag, TrendingUp } from 'lucide-react'
import { useState } from 'react'

interface PromotionCardProps {
  promotion: Promotion
  showUseCoupon?: boolean
  showAnalytics?: boolean
  onEdit?: (p: Promotion) => void
  onDelete?: (id: string) => void
  onUse?: (p: Promotion) => void
}

export function PromotionCard({ promotion, showUseCoupon, showAnalytics, onEdit, onDelete, onUse }: PromotionCardProps) {
  const [usageCount, setUsageCount] = useState(promotion.usageCount)
  const [used, setUsed] = useState(false)

  const handleUseCoupon = () => {
    if (onUse) {
      onUse(promotion)
    } else {
      setUsageCount(c => c + 1)
      setUsed(true)
    }
  }

  const isExpired = new Date(promotion.expirationDate) < new Date()
  const daysLeft = Math.ceil((new Date(promotion.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  return (
    <div className="glass-card glass-card-hover rounded-xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs border-primary/30 text-muted-foreground">
              {promotion.category}
            </Badge>
            {isExpired && (
              <Badge variant="destructive" className="text-xs">Vencida</Badge>
            )}
          </div>
          <h3 className="font-semibold text-foreground leading-snug text-balance">{promotion.title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{promotion.businessName}</p>
        </div>
        <div className="flex-shrink-0 px-3 py-1.5 rounded-lg text-center"
          style={{ background: 'linear-gradient(135deg, #B85C3822, #8F402022)', border: '1px solid rgba(184,92,56,0.2)' }}>
          <span className="font-bold text-lg text-primary">{promotion.discount}</span>
          <p className="text-xs text-muted-foreground">DTO</p>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
        {promotion.description}
      </p>

      {/* Meta */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          {isExpired ? 'Vencida' : daysLeft <= 7 ? `quedan ${daysLeft}d` : new Date(promotion.expirationDate).toLocaleDateString('es-AR', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        {showAnalytics && (
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            {usageCount} usados
          </span>
        )}
        {!showAnalytics && (
          <span className="flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" />
            {usageCount} canjeados
          </span>
        )}
      </div>

      {/* Actions */}
      {showUseCoupon && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (used) setUsed(false)
              else setUsed(true)
            }}
          >
            {used ? 'Guardado' : 'Guardar'}
          </Button>
          <Button
            size="sm"
            disabled={isExpired}
            onClick={handleUseCoupon}
            className="flex-1 btn-premium"
          >
            {isExpired ? 'Vencida' : 'Ver QR'}
          </Button>
        </div>
      )}

      {(onEdit || onDelete) && (
        <div className="flex gap-2">
          {onEdit && (
            <Button size="sm" variant="outline" onClick={() => onEdit(promotion)} className="flex-1 border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary">
              Editar
            </Button>
          )}
          {onDelete && (
            <Button size="sm" variant="destructive" onClick={() => onDelete(promotion.id)} className="flex-1">
              Eliminar
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

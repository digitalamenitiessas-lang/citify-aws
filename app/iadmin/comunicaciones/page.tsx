import { requireIAdmin } from '@/lib/auth'

export default async function ComunicacionesPage() {
  await requireIAdmin({ capability: 'communications.send' })

  return (
    <div className="space-y-4">
      <header className="glass-card rounded-2xl p-6">
        <p className="text-xs uppercase tracking-wider text-primary font-medium">Comunicaciones</p>
        <h1 className="font-serif text-2xl font-bold text-foreground mt-1">Mensajes y avisos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Avisos masivos por consorcio, audiencia segmentada por unidad o titular.
        </p>
      </header>
      <div className="glass-card rounded-2xl p-8 text-sm text-muted-foreground">
        Modulo planificado para la fase 5. Persistencia inicial reservada en iadmin_notifications.
      </div>
    </div>
  )
}

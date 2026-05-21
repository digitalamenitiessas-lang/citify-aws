import { EmailPreferencesForm } from '@/components/email-preferences-form'
import { requireProfile } from '@/lib/auth'
import { getEmailPreferencesAction } from '@/app/configuracion/actions'

export default async function ConfiguracionPage() {
  const { profile } = await requireProfile()
  const preferences = await getEmailPreferencesAction()

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      <div className="mx-auto max-w-2xl px-6">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-foreground">Configuración</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hola {profile.fullName}. Acá podés ajustar cómo te avisamos sobre la actividad de Citify.
          </p>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Notificaciones por mail</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Mantenemos siempre los mails transaccionales (bienvenida, restablecer contraseña, alertas
            de seguridad). El resto lo controlás vos.
          </p>
          <EmailPreferencesForm initial={preferences} />
        </div>
      </div>
    </div>
  )
}

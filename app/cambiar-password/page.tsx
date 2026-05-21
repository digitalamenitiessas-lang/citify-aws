import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireProfile } from '@/lib/auth'
import { findProfileById } from '@/lib/db/profiles'
import { ChangePasswordForm } from '@/components/change-password-form'
import { ROLE_HOME } from '@/lib/constants'

export default async function CambiarPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ first?: string }>
}) {
  const { profile } = await requireProfile(undefined, { allowMustChange: true })
  const fullProfile = await findProfileById(profile.id)
  const params = await searchParams

  const isForced = fullProfile?.passwordMustChange ?? false
  const cameFromLogin = params.first === '1'

  // Si el flag ya está limpio y NO viene del primer login, dejamos que use
  // /configuracion (más completo). Igualmente se permite quedarse acá si
  // querés cambiarla directamente.
  if (!isForced && !cameFromLogin) {
    redirect('/configuracion')
  }

  return (
    <div className="min-h-screen bg-background pt-16 flex items-center justify-center px-6 py-16">
      <div className="glass-card rounded-2xl p-8 w-full max-w-md">
        <h1 className="font-serif text-3xl font-bold text-foreground mb-2">
          {isForced ? 'Elegí una contraseña' : 'Cambiar contraseña'}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {isForced
            ? 'Estás usando una contraseña temporal. Antes de entrar a tu panel, creá una nueva contraseña para tu cuenta.'
            : 'Definí una contraseña nueva. Vas a tener que reingresarla la próxima vez.'}
        </p>
        <ChangePasswordForm
          requireCurrent={!isForced}
          successRedirect={ROLE_HOME[profile.role]}
        />
        {!isForced ? (
          <div className="mt-4 text-center">
            <Link href="/configuracion" className="text-sm text-muted-foreground hover:text-foreground">
              Volver a configuración
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}

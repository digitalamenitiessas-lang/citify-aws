import { LoginForm } from '@/components/login-form'
import { SetupNotice } from '@/components/setup-notice'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export default function LoginPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <SetupNotice title="Configura Supabase antes de usar el login" description="El login real depende de Supabase Auth y de la migracion SQL de perfiles." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pt-16 flex items-center justify-center px-6 py-16">
      <div className="glass-card rounded-2xl p-8 w-full max-w-md">
        <h1 className="font-serif text-3xl font-bold text-foreground mb-2">Ingresar a CITIFY</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Usa tu cuenta de Supabase Auth. El redirect al panel se resuelve segun tu rol en `profiles`.
        </p>
        <LoginForm />
      </div>
    </div>
  )
}

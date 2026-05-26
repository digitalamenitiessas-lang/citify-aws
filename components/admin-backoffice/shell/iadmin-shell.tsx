import Link from 'next/link'
import { Building2, ChevronRight } from 'lucide-react'
import type { IAdminContext } from '@/lib/types'
import { IAdminBalanceHint, IAdminNav, IAdminNotificationsBadge } from './iadmin-nav'
import { IAdminMobileTopBar } from './iadmin-mobile-topbar'
import { ChatWidget } from '@/components/ai/chat-widget'

export function IAdminShell({
  context,
  children,
  breadcrumbs,
}: {
  context: IAdminContext
  children: React.ReactNode
  breadcrumbs?: Array<{ label: string; href?: string }>
}) {
  const primary = context.primary
  const allowedCapabilities = primary?.capabilities ?? []
  const administrationName = primary?.administration.name ?? 'Sin administracion'

  return (
    <>
    <div className="min-h-screen bg-background pt-16">
      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-4 md:px-6 md:py-6">
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="glass-card sticky top-20 rounded-2xl">
            <div className="border-b border-border/40 px-4 py-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary">
                <Building2 className="w-3.5 h-3.5" />
                Backoffice administrador
              </div>
              <div className="mt-1 text-base font-semibold text-foreground">
                {administrationName}
              </div>
              {primary ? (
                <div className="text-xs text-muted-foreground mt-0.5">
                  Rol: {primary.operationalRole}
                </div>
              ) : null}
            </div>
            <IAdminNav allowedCapabilities={allowedCapabilities} />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <IAdminMobileTopBar
            administrationName={administrationName}
            operationalRole={primary?.operationalRole ?? null}
            allowedCapabilities={allowedCapabilities}
          />

          <header className="mb-4 md:mb-6 flex items-center justify-between gap-2">
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 overflow-x-auto">
              <Link href="/iadmin" className="hover:text-foreground shrink-0">
                IAdmin
              </Link>
              {breadcrumbs?.map((crumb, idx) => (
                <span key={`${crumb.label}-${idx}`} className="flex items-center gap-1.5 shrink-0">
                  <ChevronRight className="w-3 h-3" />
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-foreground">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-foreground">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
            <div className="flex items-center gap-2 shrink-0">
              <IAdminBalanceHint />
              <IAdminNotificationsBadge />
            </div>
          </header>

          {children}
        </main>
      </div>
    </div>

      <ChatWidget
        suggestions={[
          '¿Cuántos vecinos registrados hay?',
          '¿Qué expedientes están activos?',
          '¿Cuál es la ocupación de los edificios?',
          '¿Qué edificios tengo a cargo?',
        ]}
        welcomeText="Puedo responder preguntas sobre tus edificios, vecinos y expedientes."
      />
    </>
  )
}

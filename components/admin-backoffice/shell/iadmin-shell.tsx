import { cookies } from 'next/headers'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { IAdminContext } from '@/lib/types'
import { getIAdminPortfolio } from '@/lib/data'
import { IAdminSidebar, IAdminNotificationsBadge } from './iadmin-sidebar'
import { IAdminMobileTopBar } from './iadmin-mobile-topbar'
import type { SwitcherProperty } from './consorcio-switcher'
import { QuickActionsFab } from './quick-actions-fab'
import { ChatWidget } from '@/components/ai/chat-widget'

const CURRENT_PROPERTY_COOKIE = 'currentPropertyId'

export async function IAdminShell({
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

  // Defensive load: si la query del portfolio falla, no rompemos el render del layout.
  let switcherProperties: SwitcherProperty[] = []
  if (primary) {
    try {
      const portfolio = await getIAdminPortfolio(primary.administration.id)
      switcherProperties = (portfolio?.properties ?? []).map((p) => ({
        id: p.id,
        displayName: p.displayName,
        buildingName: p.buildingName,
        buildingAddress: p.buildingAddress ?? null,
        totalUnits: p.totalUnits ?? null,
      }))
    } catch (error) {
      console.error('[iadmin-shell] getIAdminPortfolio failed:', error)
    }
  }

  const cookieStore = await cookies()
  const cookiePropertyId = cookieStore.get(CURRENT_PROPERTY_COOKIE)?.value ?? null

  return (
    <>
      <div className="min-h-screen bg-background pt-16">
        <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-4 md:px-6 md:py-6">
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-20">
              <IAdminSidebar
                administrationName={administrationName}
                operationalRole={primary?.operationalRole ?? null}
                allowedCapabilities={allowedCapabilities}
                properties={switcherProperties}
                cookiePropertyId={cookiePropertyId}
              />
            </div>
          </aside>

          <main className="min-w-0 flex-1">
            <IAdminMobileTopBar
              administrationName={administrationName}
              operationalRole={primary?.operationalRole ?? null}
              allowedCapabilities={allowedCapabilities}
              properties={switcherProperties}
              cookiePropertyId={cookiePropertyId}
            />

            {/* Header simplificado: solo breadcrumb + notificaciones */}
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
                <IAdminNotificationsBadge />
              </div>
            </header>

            {children}
          </main>
        </div>
      </div>

      {/* FAB de quick actions (solo si hay capabilities suficientes) */}
      <QuickActionsFab allowedCapabilities={allowedCapabilities} />

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

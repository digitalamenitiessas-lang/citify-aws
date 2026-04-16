import Link from 'next/link'
import { ArrowRight, BarChart3, Building2, Shield, Tag, Users, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SetupNotice } from '@/components/setup-notice'
import { getHomeData } from '@/lib/data'
import { isSupabaseConfigured } from '@/lib/supabase/env'

const stats = [
  { label: 'Promociones Activas', value: '500+' },
  { label: 'Comercios Adheridos', value: '120+' },
  { label: 'Vecinos de la Ciudad', value: '12,000+' },
  { label: 'Cupones Canjeados', value: '85,000+' },
]

const features = [
  {
    icon: Tag,
    title: 'Ofertas Exclusivas',
    description: 'Accede a promociones exclusivas de comercios locales premium, pensadas para los vecinos de la ciudad.',
  },
  {
    icon: Building2,
    title: 'Herramientas para Comercios',
    description: 'Panel potente para que los comercios creen, administren y sigan sus campanas promocionales.',
  },
  {
    icon: BarChart3,
    title: 'Metricas Reales',
    description: 'Canjes, billetera de cupones y marketplace se registran directamente en Supabase.',
  },
  {
    icon: Shield,
    title: 'Accesos por Rol',
    description: 'Supabase Auth y RLS resguardan la informacion segun el perfil de cada usuario.',
  },
  {
    icon: Users,
    title: 'La Comunidad Primero',
    description: 'Diseñado para vecinos, consorcios y comercios con una misma base de datos compartida.',
  },
  {
    icon: Zap,
    title: 'Imagenes Guiadas',
    description: 'La carga de imagenes ayuda al usuario con formato, peso y resolucion recomendada.',
  },
]

export default async function HomePage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <SetupNotice />
      </div>
    )
  }

  const { promotions } = await getHomeData()
  const featuredPromotions = promotions.slice(0, 3)

  return (
    <div className="min-h-screen bg-background pt-16">
      <section className="relative min-h-screen flex items-center justify-center bg-grid overflow-hidden pt-16">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, #D4A882, transparent)' }} />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15 blur-3xl" style={{ background: 'radial-gradient(circle, #B85C38, transparent)' }} />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 border border-primary/30 text-muted-foreground" style={{ background: 'rgba(0,0,0,0.03)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Supabase + Auth + RLS + Storage ya integrado
          </div>

          <h1 className="font-serif text-5xl md:text-7xl font-bold text-foreground leading-tight text-balance mb-6">
            Descubri lo mejor de
            <span className="block" style={{ color: '#B85C38' }}>Tu Ciudad</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10 text-pretty">
            CITIFY conecta a vecinos con promociones exclusivas, marketplace interno y beneficios reales persistidos en una base de datos de Supabase.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/usuario">
              <Button size="lg" className="btn-premium gap-2 px-8">
                Panel Vecino <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/admin">
              <Button size="lg" variant="outline" className="gap-2 px-8 border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary">
                Panel Negocio
              </Button>
            </Link>
            <Link href="/consorcio">
              <Button size="lg" variant="outline" className="gap-2 px-8 border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary">
                Panel Consorcio
              </Button>
            </Link>
            <Link href="/superadmin">
              <Button size="lg" variant="outline" className="gap-2 px-8 border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary">
                Super Admin
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 border-y border-border/50" style={{ background: 'rgba(122,122,122,0.05)' }}>
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4 text-balance">Todo lo que necesitas en una sola plataforma</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-pretty">
              Desde promos exclusivas hasta cargas de imagenes asistidas, CITIFY ya trabaja con infraestructura real.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature) => (
              <div key={feature.title} className="glass-card rounded-xl p-6 hover:border-primary/30 transition-all duration-300">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: 'rgba(184, 92, 56, 0.1)', border: '1px solid rgba(184, 92, 56, 0.15)' }}>
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 border-t border-border/50" style={{ background: 'rgba(122,122,122,0.04)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="font-serif text-3xl font-bold text-foreground mb-2">Promociones Destacadas</h2>
              <p className="text-muted-foreground">Las primeras promociones reales publicadas por los comercios adheridos</p>
            </div>
            <Link href="/promotions">
              <Button variant="outline" className="gap-2 border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary">
                Ver Todas <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {featuredPromotions.length > 0 ? featuredPromotions.map((promotion) => (
              <div key={promotion.id} className="glass-card glass-card-hover rounded-xl p-5">
                {promotion.imageUrl ? (
                  <div className="rounded-xl overflow-hidden mb-4 aspect-[16/9]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={promotion.imageUrl} alt={promotion.title} className="w-full h-full object-cover" />
                  </div>
                ) : null}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xs text-muted-foreground border border-border/50 rounded px-2 py-0.5">{promotion.category}</span>
                    <h3 className="font-semibold text-foreground mt-2 text-balance">{promotion.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{promotion.businessName}</p>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg text-center flex-shrink-0" style={{ background: 'rgba(156,156,156,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <span className="font-bold text-lg text-primary">{promotion.discount}</span>
                    <p className="text-xs text-muted-foreground">DTO</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{promotion.description}</p>
                <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Vence el {new Date(promotion.expirationDate).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })}
                  </span>
                  <span className="text-xs text-muted-foreground">{promotion.usageCount} canjeados</span>
                </div>
              </div>
            )) : (
              <div className="glass-card rounded-xl p-10 md:col-span-3 text-center">
                <p className="font-medium text-foreground">Todavia no hay promociones activas.</p>
                <p className="text-sm text-muted-foreground mt-1">La base arranca vacia. Cuando un negocio publique beneficios van a aparecer aca.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

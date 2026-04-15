import Link from 'next/link'
import { Navbar } from '@/components/navbar'
import { Button } from '@/components/ui/button'
import { mockPromotions, CATEGORIES } from '@/lib/mock-data'
import { ArrowRight, Building2, Users, Tag, Shield, Zap, BarChart3 } from 'lucide-react'

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
    description: 'Accedé a promociones exclusivas de comercios locales premium, pensadas para los vecinos de la ciudad.',
  },
  {
    icon: Building2,
    title: 'Herramientas para Comercios',
    description: 'Potente panel para que los comercios creen, administren y sigan sus campañas promocionales.',
  },
  {
    icon: BarChart3,
    title: 'Métricas en Tiempo Real',
    description: 'Controlá el uso de cupones, la interacción y el retorno de inversión con paneles intuitivos.',
  },
  {
    icon: Shield,
    title: 'Comercios Verificados',
    description: 'Cada comercio es evaluado y verificado antes de unirse a la red CITIFY.',
  },
  {
    icon: Users,
    title: 'La Comunidad Primero',
    description: 'Creado para los vecinos y la comunidad, fomentando el comercio local.',
  },
  {
    icon: Zap,
    title: 'Canje Instantáneo',
    description: 'Canje de cupones con un clic: sin imprimir, sin problemas, solo ahorro.',
  },
]

export default function HomePage() {
  const featuredPromos = mockPromotions.slice(0, 3)

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center bg-grid overflow-hidden pt-16">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #D4A882, transparent)' }} />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15 blur-3xl"
            style={{ background: 'radial-gradient(circle, #B85C38, transparent)' }} />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 border border-primary/30 text-muted-foreground"
            style={{ background: 'rgba(0,0,0,0.03)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            La Plataforma de Promociones de la Ciudad
          </div>

          <h1 className="font-serif text-5xl md:text-7xl font-bold text-foreground leading-tight text-balance mb-6">
            Descubrí lo mejor de
            <span className="block" style={{ color: '#B85C38' }}>Tu Ciudad</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10 text-pretty">
            CITIFY conecta a los vecinos con promociones exclusivas de comercios locales premium.
            Descubrí, reclamá y disfrutá de ofertas pensadas para la vida urbana.
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

      {/* Stats */}
      <section className="py-16 border-y border-border/50" style={{ background: 'rgba(122,122,122,0.05)' }}>
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-1">{s.value}</div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4 text-balance">
              Todo lo que necesitás en una sola plataforma
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-pretty">
              Desde ofertas exclusivas hasta métricas para comercios, CITIFY ofrece un ecosistema completo para el comercio urbano.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="glass-card rounded-xl p-6 hover:border-primary/30 transition-all duration-300">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: 'rgba(184, 92, 56, 0.1)', border: '1px solid rgba(184, 92, 56, 0.15)' }}>
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Promotions */}
      <section className="py-20 px-6 border-t border-border/50" style={{ background: 'rgba(122,122,122,0.04)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="font-serif text-3xl font-bold text-foreground mb-2">Promociones Destacadas</h2>
              <p className="text-muted-foreground">Las mejores ofertas de nuestros comercios adheridos</p>
            </div>
            <Link href="/promotions">
              <Button variant="outline" className="gap-2 border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary">
                Ver Todas <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {featuredPromos.map((promo) => (
              <div key={promo.id} className="glass-card glass-card-hover rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xs text-muted-foreground border border-border/50 rounded px-2 py-0.5">{promo.category}</span>
                    <h3 className="font-semibold text-foreground mt-2 text-balance">{promo.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{promo.businessName}</p>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg text-center flex-shrink-0"
                    style={{ background: 'rgba(156,156,156,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <span className="font-bold text-lg text-primary">{promo.discount}</span>
                    <p className="text-xs text-muted-foreground">DTO</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{promo.description}</p>
                <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Vence el {new Date(promo.expirationDate).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })}
                  </span>
                  <span className="text-xs text-muted-foreground">{promo.usageCount} canjeados</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="glass-card rounded-2xl p-12">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4 text-balance">
              ¿Listo para unirte a CITIFY?
            </h2>
            <p className="text-muted-foreground mb-8 text-pretty">
              Ya sea que busques ofertas o seas un comercio buscando llegar a más clientes, CITIFY es para vos.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/usuario">
                <Button size="lg" className="btn-premium gap-2 px-8">
                  Panel Vecino <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/admin">
                <Button size="lg" variant="outline" className="gap-2 px-8 border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary">
                  <Building2 className="w-4 h-4" />
                  Panel Negocio
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #B85C38, #8F4020)' }}>
              <span className="text-xs font-bold text-white">C</span>
            </div>
            <span className="font-serif font-bold text-foreground">CITIFY</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2025 CITIFY. Todos los derechos reservados.</p>
          <div className="flex gap-6 text-xs text-muted-foreground">
            <Link href="/promotions" className="hover:text-foreground transition-colors">Promociones</Link>
            <Link href="/login?role=business" className="hover:text-foreground transition-colors">Para Comercios</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

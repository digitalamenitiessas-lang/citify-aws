'use client'

import { useState } from 'react'
import { Navbar } from '@/components/navbar'
import { PromotionCard } from '@/components/promotion-card'
import { mockPromotions, CATEGORIES } from '@/lib/mock-data'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

export default function PromotionsPage() {
  const [selectedCategory, setSelectedCategory] = useState('Todas')
  const [search, setSearch] = useState('')

  const filtered = mockPromotions.filter((p) => {
    const matchCat = selectedCategory === 'Todas' || p.category === selectedCategory
    const matchSearch = search.trim() === '' ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.businessName.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <section className="pt-24 pb-10 px-6 border-b border-border/50 bg-grid">
        <div className="max-w-6xl mx-auto">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-2 text-balance">
            Mercado de Promociones
          </h1>
          <p className="text-muted-foreground mb-8">
            Ofertas exclusivas de comercios verificados de la ciudad, actualizadas todos los días.
          </p>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar promociones..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-input/50 border-border/50 focus:border-primary/50 text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                selectedCategory === cat
                  ? 'text-[#ffffff] border border-primary/50'
                  : 'text-muted-foreground border border-border/50 hover:border-primary/30 hover:text-foreground'
              }`}
              style={selectedCategory === cat ? { background: 'linear-gradient(135deg, #B85C38, #8F4020)' } : { background: 'rgba(184,92,56,0.05)' }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground mb-6">
          {filtered.length} {filtered.length === 1 ? 'promoción encontrada' : 'promociones encontradas'}
        </p>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((promo) => (
              <PromotionCard key={promo.id} promotion={promo} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground">No se encontraron promociones. Probá con otra búsqueda o categoría.</p>
          </div>
        )}
      </div>
    </div>
  )
}

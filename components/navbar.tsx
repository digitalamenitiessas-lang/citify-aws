'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#DDD0BB]/60" style={{ background: 'rgba(247, 240, 228, 0.92)', backdropFilter: 'blur(16px)' }}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #B85C38, #8F4020)' }}>
            <span className="text-xs font-bold text-white">C</span>
          </div>
          <span className="font-serif text-lg font-bold tracking-wide text-foreground">CITIFY</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          <span className="text-xs font-medium px-4 py-2 rounded-full" style={{ background: 'rgba(184, 92, 56, 0.08)', border: '1px solid rgba(184, 92, 56, 0.2)', color: '#8B6B52' }}>
            desarrollado por <span className="font-semibold text-foreground">Digital Amenities</span>
          </span>
        </nav>

        {/* Mobile toggle */}
        <button className="md:hidden text-muted-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border px-6 py-4 flex flex-col gap-3" style={{ background: 'rgba(247, 240, 228, 0.98)' }}>
          <span className="text-sm font-medium text-center py-2 text-muted-foreground">
            desarrollado por <span className="text-foreground font-semibold">Digital Amenities</span>
          </span>
        </div>
      )}
    </header>
  )
}

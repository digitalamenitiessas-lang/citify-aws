'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Briefcase, LogOut, Menu, UserRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { ROLE_HOME, ROLE_LABELS } from '@/lib/constants'
import type { UserRole } from '@/lib/types'

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userState, setUserState] = useState<{ fullName: string; role: UserRole } | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  // No renderizar el navbar en rutas imprimibles o publicas
  if (pathname?.startsWith('/print') || pathname?.startsWith('/l/')) {
    return null
  }

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      return
    }

    let active = true

    async function loadSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || !active) {
        setUserState(null)
        return
      }

      const { data } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle()
      if (!active) {
        return
      }

      if (data?.role) {
        setUserState({ fullName: data.full_name ?? 'Usuario', role: data.role })
      }
    }

    loadSession()

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadSession()
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function handleLogout() {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      return
    }

    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#DDD0BB]/60" style={{ background: 'rgba(247, 240, 228, 0.92)', backdropFilter: 'blur(16px)' }}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #B85C38, #8F4020)' }}>
            <span className="text-xs font-bold text-white">C</span>
          </div>
          <span className="font-serif text-lg font-bold tracking-wide text-foreground">CITIFY</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {userState ? (
            <>
              {(userState.role === 'consorcio_admin' || userState.role === 'super_admin') ? (
                <Link href="/iadmin" className="text-xs font-medium px-3 py-2 rounded-full inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                  <Briefcase className="w-3.5 h-3.5" />
                  Backoffice
                </Link>
              ) : null}
              <Link href={ROLE_HOME[userState.role]} className="text-xs font-medium px-4 py-2 rounded-full inline-flex items-center gap-2" style={{ background: 'rgba(184, 92, 56, 0.08)', border: '1px solid rgba(184, 92, 56, 0.2)', color: '#8B6B52' }}>
                <UserRound className="w-3.5 h-3.5" />
                {userState.fullName} · <span className="font-semibold text-foreground">{ROLE_LABELS[userState.role]}</span>
              </Link>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
                Salir
              </Button>
            </>
          ) : (
            <>
              <span className="text-xs font-medium px-4 py-2 rounded-full" style={{ background: 'rgba(184, 92, 56, 0.08)', border: '1px solid rgba(184, 92, 56, 0.2)', color: '#8B6B52' }}>
                desarrollado por <span className="font-semibold text-foreground">Digital Amenities</span>
              </span>
              <Link href="/login">
                <Button size="sm" className="btn-premium">Ingresar</Button>
              </Link>
            </>
          )}
        </nav>

        <button className="md:hidden text-muted-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen ? (
        <div className="md:hidden border-t border-border px-6 py-4 flex flex-col gap-3" style={{ background: 'rgba(247, 240, 228, 0.98)' }}>
          {userState ? (
            <>
              <Link href={ROLE_HOME[userState.role]} className="text-sm font-medium text-center py-2 text-muted-foreground">
                {userState.fullName} · <span className="text-foreground font-semibold">{ROLE_LABELS[userState.role]}</span>
              </Link>
              <Button variant="outline" className="w-full gap-2" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
                Salir
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm font-medium text-center py-2 text-muted-foreground">
                desarrollado por <span className="text-foreground font-semibold">Digital Amenities</span>
              </span>
              <Link href="/login" className="w-full">
                <Button className="w-full btn-premium">Ingresar</Button>
              </Link>
            </>
          )}
        </div>
      ) : null}
    </header>
  )
}

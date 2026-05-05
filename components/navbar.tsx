'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LogOut, Menu, UserRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
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
      if (!supabase) return

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
        setUserState({ fullName: data.full_name ?? 'Usuario', role: data.role as UserRole })
      }
    }

    loadSession()

    const listener = supabase?.auth.onAuthStateChange(() => {
      loadSession()
    })

    return () => {
      active = false
      if (listener?.data?.subscription) {
        listener.data.subscription.unsubscribe()
      }
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
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/citify-logo.png"
            alt="Citify"
            width={142}
            height={108}
            priority
            className="h-8 w-auto"
          />
          <span className="text-lg font-semibold tracking-tight text-foreground">Citify</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {userState ? (
            <>
              <Link href={ROLE_HOME[userState.role]} className="text-xs font-medium px-4 py-2 rounded-full inline-flex items-center gap-2" style={{ background: 'rgba(240, 78, 35, 0.08)', border: '1px solid rgba(240, 78, 35, 0.2)', color: 'var(--muted-foreground)' }}>
                <UserRound className="w-3.5 h-3.5" />
                {userState.fullName} · <span className="font-semibold text-foreground">{ROLE_LABELS[userState.role]}</span>
              </Link>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
                Salir
              </Button>
              <ThemeToggle />
            </>
          ) : (
            <>
              <span className="text-xs font-medium px-4 py-2 rounded-full" style={{ background: 'rgba(240, 78, 35, 0.08)', border: '1px solid rgba(240, 78, 35, 0.2)', color: 'var(--muted-foreground)' }}>
                desarrollado por <span className="font-semibold text-foreground">Digital Amenities</span>
              </span>
              <Link href="/login">
                <Button size="sm" className="btn-premium">Ingresar</Button>
              </Link>
              <ThemeToggle />
            </>
          )}
        </nav>

        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <button className="text-muted-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="md:hidden border-t border-border px-6 py-4 flex flex-col gap-3 bg-background/98">
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

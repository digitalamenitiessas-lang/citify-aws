'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { dispatchAuthStateChanged } from '@/lib/auth/client'
import { ROLE_HOME } from '@/lib/constants'
import type { UserRole } from '@/lib/types'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    setLoading(true)
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    const payload = await response.json().catch(() => null)
    setLoading(false)

    if (!response.ok || !payload?.profile?.role) {
      setError(payload?.error ?? 'No se pudo iniciar sesion.')
      return
    }

    dispatchAuthStateChanged({ status: 'login' })
    router.push(ROLE_HOME[payload.profile.role as UserRole])
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="citify-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu@email.com"
          required
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="bg-input/50 border-border/50"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="citify-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          required
          autoComplete="new-password"
          className="bg-input/50 border-border/50"
        />
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Button type="submit" className="w-full btn-premium gap-2" disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
        Ingresar
      </Button>
    </form>
  )
}

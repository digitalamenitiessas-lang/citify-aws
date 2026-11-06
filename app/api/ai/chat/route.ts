import { NextRequest } from 'next/server'
import { getCurrentProfile } from '@/lib/auth'
import {
  buildVecinoContext,
  buildConsorcioContext,
  buildNegocioContext,
  buildSuperAdminContext,
} from '@/lib/ai/context-builders'
import { buildSystemPrompt } from '@/lib/ai/system-prompts'
import { upstreamErrorCode, type CiroErrorCode } from '@/lib/ai/ciro-errors'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? 'meta-llama/llama-3.3-8b-instruct:free'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://citify.app'

// Cuanto esperar a que OpenRouter EMPIECE a responder. Sin limite, un proveedor
// colgado dejaba a Ciro "pensando" para siempre. No limita la duracion de la
// respuesta: una vez que llega el primer byte, el streaming sigue lo que haga falta.
const UPSTREAM_HEADERS_TIMEOUT_MS = 30_000

/**
 * Error para el widget: solo el codigo (ver lib/ai/ciro-errors.ts). El detalle
 * tecnico va al log, nunca a la pantalla.
 */
function fail(code: CiroErrorCode, status: number, logDetail?: unknown) {
  if (logDetail !== undefined) console.error(`[Ciro] ${code}:`, logDetail)
  return new Response(JSON.stringify({ code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile()
  if (!profile) return fail('unauthenticated', 401)

  const role = profile.role as 'super_admin' | 'negocio_admin' | 'consorcio_admin' | 'vecino'

  let messages: { role: 'user' | 'assistant'; content: string }[]
  try {
    const body = await req.json()
    messages = body.messages ?? []
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('sin mensajes')
  } catch (err) {
    return fail('bad_request', 400, err)
  }

  let systemPrompt: string
  try {
    let ctx
    switch (role) {
      case 'vecino':
        ctx = await buildVecinoContext(profile.id)
        break
      case 'consorcio_admin':
        ctx = await buildConsorcioContext(profile.id)
        break
      case 'negocio_admin':
        ctx = await buildNegocioContext(profile.id)
        break
      case 'super_admin':
        ctx = await buildSuperAdminContext()
        break
    }
    if (!ctx) throw new Error(`sin contexto para el rol ${role}`)
    systemPrompt = buildSystemPrompt(ctx)
  } catch (err) {
    return fail('context_failed', 500, err)
  }

  if (!OPENROUTER_API_KEY) {
    return fail('not_configured', 503, 'falta OPENROUTER_API_KEY en el entorno')
  }

  // Si la persona cierra la pestaña, se corta tambien el pedido a OpenRouter:
  // no tiene sentido seguir pagando una respuesta que nadie va a leer.
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), UPSTREAM_HEADERS_TIMEOUT_MS)

  let upstream: Response
  try {
    upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.any([req.signal, timeout.signal]),
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': SITE_URL,
        'X-Title': 'Citify - Ciro',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        stream: true,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: 800,
        temperature: 0.7,
      }),
    })
  } catch (err) {
    const why = timeout.signal.aborted ? `sin respuesta en ${UPSTREAM_HEADERS_TIMEOUT_MS / 1000}s` : err
    return fail('unavailable', 504, req.signal.aborted ? undefined : why)
  } finally {
    clearTimeout(timer)
  }

  if (!upstream.ok) {
    const code = upstreamErrorCode(upstream.status)
    const body = (await upstream.text().catch(() => '')).slice(0, 500)
    return fail(code, upstream.status === 429 ? 429 : 502, `OpenRouter ${upstream.status} ${body}`)
  }

  // Se reenvia el streaming tal cual. Si se corta a mitad de camino, se manda un
  // ultimo evento con el error, para que el widget avise en vez de quedarse con
  // media respuesta y sin explicacion.
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()

  ;(async () => {
    const reader = upstream.body!.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        await writer.write(value)
      }
    } catch (err) {
      if (!req.signal.aborted) {
        console.error('[Ciro] interrupted:', err)
        const event = `data: ${JSON.stringify({ error: { code: 'interrupted' } })}\n\n`
        await writer.write(new TextEncoder().encode(event)).catch(() => {})
      }
    } finally {
      await writer.close().catch(() => {})
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, Loader2, RotateCcw, Send, X } from 'lucide-react'
import { CiroAvatar, CiroMark } from '@/components/ai/ciro-avatar'
import { CIRO_PANELS, type CiroPanel } from '@/components/ai/ciro-panels'
import { isCiroErrorCode, type CiroErrorCode } from '@/lib/ai/ciro-errors'

// ─── types ───────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// ─── errores ─────────────────────────────────────────────────────────────────

// Lo que dice Ciro cuando algo falla: que paso y que hacer, en su voz, sin
// jerga tecnica. `retry`: si reintentar tiene sentido (con la clave mal o sin
// credito, reintentar no arregla nada). `detail`: solo para el superadmin, para
// poder diagnosticar sin entrar al servidor.
const ERROR_COPY: Record<CiroErrorCode, { text: string; retry: boolean; detail?: string }> = {
  unauthenticated: {
    text: 'Tu sesión se cerró. Iniciá sesión de nuevo para seguir conversando.',
    retry: false,
  },
  bad_request: {
    text: 'Algo salió mal con tu mensaje. Probá de nuevo.',
    retry: true,
    detail: 'El widget mandó un pedido inválido (es un bug). Detalle en journalctl -u citify.',
  },
  context_failed: {
    text: 'No pude leer tu información en este momento. Probá de nuevo en un rato.',
    retry: true,
    detail: 'Falló la lectura de la base para armar el contexto. Detalle en journalctl -u citify.',
  },
  not_configured: {
    text: 'No estoy disponible en este momento. Probá más tarde.',
    retry: false,
    detail: 'Falta la clave de OpenRouter o es inválida: OPENROUTER_API_KEY en /etc/citify/app.env.',
  },
  credits_exhausted: {
    text: 'No estoy disponible en este momento. Probá más tarde.',
    retry: false,
    detail: 'La clave de OpenRouter llegó a su límite de crédito. Subilo en openrouter.ai.',
  },
  refused: {
    text: 'No puedo ayudarte con ese mensaje. Probá decirlo de otra forma.',
    retry: false,
  },
  busy: {
    text: 'Estoy con muchas consultas a la vez. Esperá unos segundos y probá de nuevo.',
    retry: true,
    detail: 'OpenRouter limitó la cantidad de pedidos (429).',
  },
  unavailable: {
    text: 'No pude conectarme para responderte. Probá de nuevo en un momento.',
    retry: true,
    detail: 'OpenRouter no respondió o devolvió un error. Detalle en journalctl -u citify.',
  },
  interrupted: { text: 'Se cortó mi respuesta.', retry: true },
  empty: { text: 'No me salió una respuesta. ¿Probamos de nuevo?', retry: true },
  offline: { text: 'Parece que no tenés conexión. Revisala y probá de nuevo.', retry: true },
}

// ─── streaming ───────────────────────────────────────────────────────────────

/**
 * Lee el streaming SSE de la respuesta.
 *
 * Los fragmentos de red no respetan los limites de linea: una linea puede llegar
 * partida en dos. Antes se parseaba cada fragmento por separado y la linea
 * partida se descartaba como JSON invalido, asi que podian faltar palabras en la
 * respuesta. Ahora lo incompleto queda en `pending` hasta que llega el resto.
 */
function createSSEParser() {
  let pending = ''
  return function feed(chunk: string): { text: string; error: CiroErrorCode | null } {
    pending += chunk
    const lines = pending.split('\n')
    pending = lines.pop() ?? '' // la ultima puede estar incompleta
    let text = ''
    let error: CiroErrorCode | null = null
    for (const line of lines) {
      if (!line.startsWith('data:')) continue // incluye los ": OPENROUTER PROCESSING"
      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        if (json?.error) {
          // El servidor manda { error: { code } } si el streaming se corta, y
          // OpenRouter manda { error: { message } } si falla a mitad de camino.
          error = isCiroErrorCode(json.error.code) ? json.error.code : 'interrupted'
          continue
        }
        const delta = json?.choices?.[0]?.delta?.content
        if (typeof delta === 'string') text += delta
      } catch {
        // Una linea completa que no es JSON: no deberia pasar. Se ignora.
      }
    }
    return { text, error }
  }
}

// ─── inline markdown renderer ─────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const result: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Bullet list: lines starting with '- ' or '* '
    if (/^[-*]\s/.test(line)) {
      result.push(
        <div key={i} className="flex gap-1.5 my-0.5">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
          <span>{renderInline(line.replace(/^[-*]\s/, ''))}</span>
        </div>
      )
      continue
    }

    // Empty line → spacing
    if (line.trim() === '') {
      result.push(<div key={i} className="h-1.5" />)
      continue
    }

    result.push(<div key={i}>{renderInline(line)}</div>)
  }

  return result
}

function renderInline(text: string): React.ReactNode {
  // Split on **bold**, *italic*, `code`
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((part, idx) => {
        if (/^\*\*(.+)\*\*$/.test(part)) {
          return <strong key={idx} className="font-semibold">{part.slice(2, -2)}</strong>
        }
        if (/^\*(.+)\*$/.test(part)) {
          return <em key={idx}>{part.slice(1, -1)}</em>
        }
        if (/^`(.+)`$/.test(part)) {
          return (
            <code key={idx} className="rounded bg-muted px-1 py-0.5 text-xs font-mono text-foreground">
              {part.slice(1, -1)}
            </code>
          )
        }
        return <span key={idx}>{part}</span>
      })}
    </>
  )
}

// ─── bubble ──────────────────────────────────────────────────────────────────

function MessageBubble({ msg, active = false }: { msg: Message; active?: boolean }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {/* Mientras Ciro escribe esta respuesta, sus ondas laten. */}
      {!isUser && <CiroAvatar size="sm" active={active} className="mr-2 mt-0.5" />}
      <div
        className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed sm:max-w-[80%] ${
          isUser
            ? 'text-white rounded-tr-sm whitespace-pre-wrap'
            : 'text-foreground rounded-tl-sm border border-border bg-card shadow-sm'
        }`}
        style={isUser ? { background: 'linear-gradient(135deg, #F04E23, #C73E15)' } : undefined}
      >
        {isUser ? msg.content : renderMarkdown(msg.content)}
      </div>
    </div>
  )
}

// ─── quick suggestions ────────────────────────────────────────────────────────

function Suggestions({ onSelect, items }: { onSelect: (text: string) => void; items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2 border-t border-border/40 bg-muted/10 p-3">
      {items.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="rounded-full border border-border/50 bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
        >
          {s}
        </button>
      ))}
    </div>
  )
}

// ─── main widget ──────────────────────────────────────────────────────────────

/**
 * Ciro. `panel` define la bienvenida y las sugerencias (components/ai/ciro-panels.ts):
 * cada panel ofrece solo lo que Ciro puede contestar con los datos de ese rol.
 */
export function ChatWidget({ panel }: { panel: CiroPanel }) {
  const { welcome: welcomeText, suggestions } = CIRO_PANELS[panel]
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<CiroErrorCode | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Pide la respuesta para `history` (que termina en un mensaje de la persona) y
  // la va escribiendo a medida que llega.
  async function requestReply(history: Message[]) {
    setError(null)
    setIsStreaming(true)
    setMessages([...history, { role: 'assistant', content: '' }])

    let accumulated = ''
    let failure: CiroErrorCode | null = null

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => null)
        failure = isCiroErrorCode(json?.code) ? json.code : 'unavailable'
      } else {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        const feed = createSSEParser()

        for (let done = false; !done; ) {
          const step = await reader.read()
          done = step.done
          // Al terminar se fuerza un salto de linea para procesar la ultima linea.
          const parsed = feed(done ? decoder.decode() + '\n' : decoder.decode(step.value, { stream: true }))
          if (parsed.error) failure = parsed.error
          if (parsed.text) {
            accumulated += parsed.text
            const content = accumulated
            setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content }])
          }
        }

        if (!failure && accumulated.trim() === '') failure = 'empty'
      }
    } catch {
      // fetch o la lectura tiraron: o no hay conexion, o se corto en el medio.
      failure = navigator.onLine === false ? 'offline' : 'interrupted'
    } finally {
      // "Se corto mi respuesta" solo tiene sentido si algo llego.
      if (failure === 'interrupted' && !accumulated) failure = 'unavailable'
      // Si no llego nada se saca la respuesta vacia. Si llego algo se deja: media
      // respuesta sirve mas que ninguna, y el error avisa que se corto.
      if (!accumulated) setMessages((prev) => prev.slice(0, -1))
      setError(failure)
      setIsStreaming(false)
    }
  }

  function sendMessage(text?: string) {
    const content = (text ?? input).trim()
    if (!content || isStreaming) return
    setInput('')
    requestReply([...messages, { role: 'user', content }])
  }

  // Reintenta la ultima pregunta. Si habia quedado media respuesta, se descarta.
  function retry() {
    const lastUser = messages.map((m) => m.role).lastIndexOf('user')
    if (lastUser === -1 || isStreaming) return
    requestReply(messages.slice(0, lastUser + 1))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <>
      {/* ── Floating button ─────────────────────────────────────────────────── */}
      <button
        id="ai-chat-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Cerrar el chat con Ciro' : 'Hablar con Ciro'}
        className="fixed bottom-24 right-3 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--citify-terracotta)] text-white transition-all hover:scale-110 active:scale-95 sm:right-4"
        style={{ boxShadow: '0 0 0 1px rgba(199, 62, 21, 0.18), 0 8px 32px rgba(199, 62, 21, 0.4)' }}
      >
        {open ? <ChevronDown className="h-6 w-6" /> : <CiroMark className="h-8 w-8" active={isStreaming} />}
      </button>

      {/* ── Chat panel ──────────────────────────────────────────────────────── */}
      <div
        className={`fixed inset-x-3 bottom-20 z-50 flex max-h-[min(76vh,42rem)] flex-col overflow-hidden rounded-[1.6rem] border border-border bg-background/95 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-all duration-300 sm:inset-x-auto sm:bottom-40 sm:right-4 sm:w-[min(380px,calc(100vw-2rem))] ${
          open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        style={{ boxShadow: '0 24px 80px rgba(199, 62, 21,0.16)' }}
      >
        {/* Header */}
        <div
          className="flex flex-shrink-0 items-center justify-between px-4 py-3"
          style={{ background: 'linear-gradient(135deg, #F04E23, #C73E15)' }}
        >
          <div className="flex items-center gap-2.5">
            <CiroAvatar size="md" active={isStreaming} />
            <div>
              <p className="font-display text-base font-semibold leading-tight text-white">Ciro</p>
              <p className="text-xs text-white/70">de Citify</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-white/70 hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages area */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {isEmpty && (
            <div className="flex h-full flex-col items-center justify-center gap-3 pb-4 text-center">
              <CiroAvatar size="lg" />
              <div>
                <p className="font-display text-base font-semibold text-foreground">¡Hola! Soy Ciro</p>
                <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                  {welcomeText}
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isLast = i === messages.length - 1
            // La respuesta vacia es el lugar donde va a llegar el texto: mientras
            // no llega nada se muestra "Ciro esta pensando", no una burbuja vacia.
            if (msg.role === 'assistant' && msg.content === '') return null
            return <MessageBubble key={i} msg={msg} active={isStreaming && isLast} />
          })}

          {isStreaming && messages[messages.length - 1]?.content === '' && (
            <div className="mb-3 flex items-center gap-2">
              <CiroAvatar size="sm" active />
              <span className="text-xs text-muted-foreground">Ciro está pensando…</span>
            </div>
          )}

          {/* El error lo dice Ciro, en su burbuja: que paso y que hacer. */}
          {error && (
            <div className="mb-3 flex justify-start">
              <CiroAvatar size="sm" className="mr-2 mt-0.5" />
              <div className="max-w-[88%] rounded-2xl rounded-tl-sm border border-dashed border-border bg-muted/40 px-3.5 py-2.5 text-sm leading-relaxed text-foreground sm:max-w-[80%]">
                <p>{ERROR_COPY[error].text}</p>
                {panel === 'superadmin' && ERROR_COPY[error].detail && (
                  <p className="mt-1 text-xs text-muted-foreground">{ERROR_COPY[error].detail}</p>
                )}
                {error === 'unauthenticated' ? (
                  <a
                    href="/login"
                    className="mt-2 inline-flex text-xs font-semibold text-[var(--citify-terracotta-dark)] hover:underline dark:text-[var(--citify-terracotta)]"
                  >
                    Iniciar sesión
                  </a>
                ) : (
                  ERROR_COPY[error].retry && (
                    <button
                      onClick={retry}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--citify-terracotta-dark)] hover:underline dark:text-[var(--citify-terracotta)]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reintentar
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggestions (only when empty) */}
        {isEmpty && <Suggestions onSelect={(s) => sendMessage(s)} items={suggestions} />}

        {/* Input */}
        <div
          className="flex flex-shrink-0 items-end gap-2 border-t border-border/40 bg-background/90 px-3 py-3"
        >
          <textarea
            ref={inputRef}
            id="ai-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribile a Ciro…"
            rows={1}
            disabled={isStreaming}
            className="max-h-28 flex-1 resize-none overflow-y-auto bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
            style={{ minHeight: '24px' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 112) + 'px'
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isStreaming}
            id="ai-chat-send"
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #F04E23, #C73E15)' }}
            aria-label="Enviar mensaje"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
      </div>
    </>
  )
}

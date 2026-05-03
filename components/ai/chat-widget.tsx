'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Bot, ChevronDown, Loader2, Send, Sparkles, X } from 'lucide-react'

// ─── types ───────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function parseSSEChunk(raw: string): string {
  let text = ''
  const lines = raw.split('\n')
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue
    const data = line.slice(6).trim()
    if (data === '[DONE]') continue
    try {
      const json = JSON.parse(data)
      const delta = json?.choices?.[0]?.delta?.content
      if (typeof delta === 'string') text += delta
    } catch {
      // skip malformed chunks
    }
  }
  return text
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
            <code key={idx} className="px-1 py-0.5 rounded text-xs font-mono" style={{ background: 'rgba(0,0,0,0.08)' }}>
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

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
          style={{ background: 'linear-gradient(135deg, #F04E23, #C73E15)' }}
        >
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div
        className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'text-white rounded-tr-sm whitespace-pre-wrap'
            : 'text-foreground rounded-tl-sm border border-border/40'
        }`}
        style={
          isUser
            ? { background: 'linear-gradient(135deg, #F04E23, #C73E15)' }
            : { background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)' }
        }
      >
        {isUser ? msg.content : renderMarkdown(msg.content)}
      </div>
    </div>
  )
}

// ─── quick suggestions ────────────────────────────────────────────────────────

const DEFAULT_SUGGESTIONS = [
  '¿Qué cupones tengo disponibles?',
  '¿Hay algo nuevo en el mercado vecinal?',
  '¿Cuál es el estado de mis reclamos?',
  '¿Qué promociones vencen pronto?',
]

function Suggestions({ onSelect, items }: { onSelect: (text: string) => void; items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2 p-3 border-t border-border/30">
      {items.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="px-3 py-1.5 rounded-full text-xs font-medium border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
          style={{ background: 'rgba(240, 78, 35,0.05)' }}
        >
          {s}
        </button>
      ))}
    </div>
  )
}

// ─── main widget ──────────────────────────────────────────────────────────────

export function ChatWidget({
  suggestions = DEFAULT_SUGGESTIONS,
  welcomeText = 'Puedo responder preguntas sobre tus cupones, el mercado vecinal, tus reclamos y más.',
}: {
  suggestions?: string[]
  welcomeText?: string
} = {}) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim()
    if (!content || isStreaming) return

    setInput('')
    setError(null)

    const userMsg: Message = { role: 'user', content }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setIsStreaming(true)

    // Placeholder assistant message that we'll stream into
    const assistantPlaceholder: Message = { role: 'assistant', content: '' }
    setMessages((prev) => [...prev, assistantPlaceholder])

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Error del servidor.')
      }

      if (!res.body) throw new Error('Sin respuesta.')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const delta = parseSSEChunk(chunk)
        if (delta) {
          accumulated += delta
          setMessages((prev) => {
            const copy = [...prev]
            copy[copy.length - 1] = { role: 'assistant', content: accumulated }
            return copy
          })
        }
      }
    } catch (err: any) {
      setError(err?.message ?? 'Ocurrió un error. Intentá de nuevo.')
      // Remove the empty assistant placeholder on error
      setMessages((prev) => prev.filter((_, i) => i !== prev.length - 1))
    } finally {
      setIsStreaming(false)
    }
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
        aria-label="Abrir asistente IA"
        className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #F04E23, #C73E15)',
          boxShadow: '0 8px 32px rgba(199, 62, 21,0.45)',
        }}
      >
        {open ? (
          <ChevronDown className="w-6 h-6 text-white" />
        ) : (
          <Sparkles className="w-6 h-6 text-white" />
        )}
      </button>

      {/* ── Chat panel ──────────────────────────────────────────────────────── */}
      <div
        className={`fixed bottom-40 right-4 z-50 w-[min(380px,calc(100vw-2rem))] rounded-2xl overflow-hidden flex flex-col transition-all duration-300 ${
          open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        style={{
          height: '520px',
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(240, 78, 35,0.18)',
          boxShadow: '0 24px 80px rgba(199, 62, 21,0.22)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #F04E23, #C73E15)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">Asistente Citify</p>
              <p className="text-white/70 text-xs">Powered by IA</p>
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
        <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
          {isEmpty && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(240, 78, 35,0.15), rgba(199, 62, 21,0.1))' }}
              >
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">¡Hola! Soy tu asistente</p>
                <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                  {welcomeText}
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}

          {isStreaming && messages[messages.length - 1]?.content === '' && (
            <div className="flex items-center gap-2 ml-9 mb-3">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground">Pensando...</span>
            </div>
          )}

          {error && (
            <div className="mx-1 mb-3 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggestions (only when empty) */}
        {isEmpty && <Suggestions onSelect={(s) => sendMessage(s)} items={suggestions} />}

        {/* Input */}
        <div
          className="flex items-end gap-2 px-3 py-3 flex-shrink-0 border-t border-border/30"
          style={{ background: 'rgba(255,255,255,0.8)' }}
        >
          <textarea
            ref={inputRef}
            id="ai-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí tu pregunta..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none text-sm outline-none bg-transparent text-foreground placeholder:text-muted-foreground leading-relaxed max-h-28 overflow-y-auto"
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

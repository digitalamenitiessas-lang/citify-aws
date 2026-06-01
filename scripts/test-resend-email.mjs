// Prueba de deliverability de Resend, aislada del resto del sistema.
// No toca la DB (que no es alcanzable desde la maquina de dev por el VPC):
// solo valida que RESEND_API_KEY + dominio verificado entregan a un inbox real.
//
// Uso:
//   node scripts/test-resend-email.mjs destinatario@ejemplo.com
//
// Lee RESEND_API_KEY y RESEND_FROM_ADDRESS de .env.local (parseo manual,
// sin dotenv). El From debe ser de un dominio verificado en Resend.

import { readFileSync } from 'node:fs'
import { Resend } from 'resend'

function loadEnvLocal() {
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      const key = m[1]
      let val = m[2].trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = val
    }
  } catch {
    console.warn('No pude leer .env.local; uso variables del entorno tal cual.')
  }
}

async function main() {
  loadEnvLocal()

  const to = process.argv[2]
  if (!to) {
    console.error('Falta el destinatario.\n  node scripts/test-resend-email.mjs destinatario@ejemplo.com')
    process.exit(1)
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('RESEND_API_KEY no esta en .env.local / el entorno.')
    process.exit(1)
  }

  const from =
    process.env.RESEND_FROM_ADDRESS ??
    process.env.EMAIL_FROM_ADDRESS ??
    process.env.SES_FROM_ADDRESS ??
    'Citify <noreply@citify.com.ar>'

  console.log(`Enviando con Resend:\n  from: ${from}\n  to:   ${to}`)

  const resend = new Resend(apiKey)
  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: 'Prueba de Citify (Resend)',
    text: 'Si recibis este mail, Resend esta entregando correctamente. Esta es una prueba de deliverability de Citify.',
    html: '<p>Si recibís este mail, <strong>Resend está entregando correctamente</strong>.</p><p>Esta es una prueba de deliverability de Citify.</p>',
  })

  if (error) {
    console.error('FALLO:', error)
    process.exit(1)
  }

  console.log('OK. messageId:', data?.id)
  console.log('Revisá el inbox (y spam) del destinatario.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

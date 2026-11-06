// Errores de Ciro.
//
// El servidor (app/api/ai/chat/route.ts) responde un CODIGO estable y el widget
// (components/ai/chat-widget.tsx) elige el mensaje que ve la persona. El detalle
// tecnico va al log del servidor (journalctl -u citify), nunca a la pantalla
// de un vecino. Antes se mostraba el texto crudo del servidor
// ("OPENROUTER_API_KEY no configurada en el servidor.") en un recuadro rojo.

export type CiroErrorCode =
  | 'unauthenticated' //   la sesion vencio
  | 'bad_request' //       el widget mando algo invalido (seria un bug nuestro)
  | 'context_failed' //    fallo la lectura de los datos del usuario
  | 'not_configured' //    falta la clave de OpenRouter, o es invalida
  | 'credits_exhausted' // la clave llego a su limite de credito
  | 'refused' //           OpenRouter rechazo el mensaje por moderacion
  | 'busy' //              OpenRouter limito la cantidad de pedidos
  | 'unavailable' //       OpenRouter caido, lento o inalcanzable desde el servidor
  | 'interrupted' //       la respuesta se corto a mitad de camino
  | 'empty' //             el modelo termino sin decir nada
  | 'offline' //           el navegador no tiene conexion

/**
 * Codigo para una respuesta de error de OpenRouter, segun su status
 * (https://openrouter.ai/docs/api-reference/errors).
 */
export function upstreamErrorCode(status: number): CiroErrorCode {
  if (status === 401) return 'not_configured' // clave invalida o revocada
  if (status === 402) return 'credits_exhausted' // sin credito, o la clave llego a su limite
  if (status === 403) return 'refused' // la moderacion marco el mensaje
  if (status === 429) return 'busy'
  return 'unavailable' // 408, 502, 503 y cualquier otro
}

export function isCiroErrorCode(value: unknown): value is CiroErrorCode {
  return (
    typeof value === 'string' &&
    [
      'unauthenticated', 'bad_request', 'context_failed', 'not_configured', 'credits_exhausted',
      'refused', 'busy', 'unavailable', 'interrupted', 'empty', 'offline',
    ].includes(value)
  )
}

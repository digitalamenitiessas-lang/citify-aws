// ---------------------------------------------------------------------------
// Politica de contraseñas. FUENTE UNICA.
//
// Esta en .mjs y no en .ts a proposito: la comparten el codigo de la app
// (lib/auth/password.ts, que la re-exporta) y scripts/db/seed-superadmin.mjs,
// que es un script suelto de Node y no puede importar TypeScript.
//
// Antes estaba duplicada en los dos lados con un comentario que decia "misma
// politica que lib/auth/password.ts". Cuando se bajo el minimo de 10 a 6, el
// script quedo en 10 y rechazaba contraseñas que la app si aceptaba, con un
// mensaje de error que no coincidia con ninguna regla vigente. Por eso ahora
// hay un solo lugar.
//
// Si cambia la politica, se cambia ACA y en ningun otro lado.
// ---------------------------------------------------------------------------

// 8 caracteres, sin exigir combinacion de tipos: es lo que Citify ya exigia
// en los formularios y endpoints cuando la politica la imponia Cognito.
// (Countrify la bajo a 6 por decision de su dueño; Citify no.)
//
// Lo que ademas sostiene la seguridad:
//   - lib/rate-limit.ts limita los intentos de login por IP y por cuenta. Es la
//     defensa real contra fuerza bruta online.
//   - Los hashes son argon2id (19 MiB, t=2), asi que romperlos offline con la
//     base filtrada sigue siendo caro.
//
// Sobre no exigir "3 de 4 tipos": las guias actuales (NIST SP 800-63B) la
// desaconsejan. Si alguna vez se endurece, subir la longitud antes que agregar
// reglas de composicion.
export const PASSWORD_MIN_LENGTH = 8

// 72 es el limite de bcrypt y se mantiene por si algun dia se cambia de
// algoritmo; argon2 no tiene ese tope.
export const PASSWORD_MAX_LENGTH = 72

/**
 * Devuelve null si la contraseña es valida, o el mensaje de error.
 * Los mensajes van en español porque se muestran tal cual al usuario.
 */
export function validatePasswordPolicy(pwd) {
  if (typeof pwd !== 'string') return 'Contraseña inválida.'
  if (pwd.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`
  }
  if (pwd.length > PASSWORD_MAX_LENGTH) return 'La contraseña es demasiado larga.'
  return null
}

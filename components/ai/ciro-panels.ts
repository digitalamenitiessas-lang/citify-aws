// Que ofrece Ciro en cada panel: la bienvenida y las sugerencias.
//
// REGLA: una sugerencia solo puede proponer algo que Ciro puede contestar con
// los datos que recibe (lib/ai/context-builders.ts, segun el rol). Una
// sugerencia que termina en "no tengo esa informacion" es peor que ninguna.
// Antes de agregar una, verificar que el dato este en el contexto del rol.
//
// Ojo con los limites: si el contexto trae una parte de los datos, la pregunta
// tiene que poder contestarse con ESA parte. El vecino recibe las 20 promociones
// mas nuevas, asi que "¿que vence esta semana?" daria una respuesta incompleta
// (justo las que vencen primero son las mas viejas); el negocio, en cambio,
// recibe todas las suyas.
//
// Lo que Ciro NO sabe todavia (2026-10): expensas, pagos y unidades del vecino,
// y gastos, liquidaciones y cobranzas del administrador. Por eso los paneles
// `unidades` y `administracion` no sugieren nada de eso.

export type CiroPanel = 'beneficios' | 'unidades' | 'negocio' | 'administracion' | 'superadmin'

export const CIRO_PANELS: Record<CiroPanel, { welcome: string; suggestions: string[] }> = {
  // /usuario — vecino. Contexto: promociones, cupones guardados, mercado vecinal, reclamos.
  beneficios: {
    welcome: 'Te ayudo con tus beneficios, el mercado vecinal y tus reclamos.',
    suggestions: [
      '¿Qué cupones tengo sin usar?',
      '¿Qué promociones nuevas hay?',
      '¿Qué hay en el mercado vecinal?',
      '¿Cómo van mis reclamos?',
    ],
  },

  // /vecino — vecino principal. Mismo contexto que `beneficios`: todavia no
  // incluye expensas ni pagos, que es lo central de este panel.
  unidades: {
    welcome: 'Te ayudo con tus reclamos, los beneficios del edificio y el mercado vecinal.',
    suggestions: [
      '¿Cómo van mis reclamos?',
      '¿Qué beneficios tengo disponibles?',
      '¿Qué promociones nuevas hay?',
      '¿Qué hay en el mercado vecinal?',
    ],
  },

  // /admin — negocio. Contexto: datos del negocio, sus promociones con canjes y
  // vencimiento, total de canjes y vecinos en la plataforma.
  negocio: {
    welcome: 'Te ayudo con tus promociones, los canjes y el alcance de tu negocio.',
    suggestions: [
      '¿Cuál es mi promoción con más canjes?',
      '¿Qué promociones vencen esta semana?',
      '¿Cuántos canjes tuve en total?',
      '¿Qué promociones tengo inactivas?',
    ],
  },

  // /iadmin — administrador de consorcio. Contexto: sus consorcios con unidades,
  // vecinos registrados, ocupacion y expedientes.
  administracion: {
    welcome: 'Te ayudo con los vecinos, la ocupación y los expedientes de tus consorcios.',
    suggestions: [
      '¿Qué expedientes siguen abiertos?',
      '¿Cuál es la ocupación de cada consorcio?',
      '¿Cuántos vecinos registrados hay?',
      '¿Qué consorcios tengo a cargo?',
    ],
  },

  // /superadmin. Contexto: totales de la plataforma, ocupacion por consorcio,
  // negocios con promociones y canjes, y las 20 promociones mas recientes.
  superadmin: {
    welcome: 'Te ayudo con el estado general de la plataforma: consorcios, negocios y promociones.',
    suggestions: [
      'Dame un resumen de la plataforma',
      '¿Qué negocios tienen más canjes?',
      '¿Qué consorcios tienen menos ocupación?',
      '¿Qué promociones se publicaron últimamente?',
    ],
  },
}

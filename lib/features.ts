// Interruptor de secciones.
//
// Decision de los socios (2026-11-05): por ahora el administrador de consorcio
// usa solo Comunicados, la Pizarra de quejas y Vecinos. Todo lo de expensas
// (gastos, cobranzas, liquidaciones, cuentas) queda APAGADO, no borrado: el
// codigo y los datos siguen intactos, y para volver a prender una seccion
// alcanza con pasarla a true.
//
// Una seccion apagada no aparece en el menu, y si alguien entra por link a una
// de sus paginas, middleware.ts lo manda al inicio de su panel.
//
// Este archivo lo importa middleware.ts (corre en el edge): solo constantes,
// nada de imports de la base ni de Node.

export const IADMIN_SECTIONS = {
  // Lo que queda prendido
  comunicados: true,
  pizarra: true,
  vecinos: true,

  // Apagado por ahora
  gastos: false, //      /iadmin/gastos y /iadmin/proveedores
  cobranzas: false, //   /iadmin/cobranzas y /iadmin/recordatorios
  mesaDelMes: false, //  /iadmin/consorcios/[id], /iadmin/liquidaciones, /iadmin/cartera
  datosYUnidades: false,
  cuentas: false,
  importar: false,
  reportes: false,
  reclamos: false, //    el sistema de expedientes viejo; lo reemplaza la pizarra
} as const

export type IAdminSection = keyof typeof IADMIN_SECTIONS

/** Expensas del vecino: /vecino (saldo, liquidaciones e "Informar pago"). */
export const VECINO_EXPENSAS = false

/**
 * Expedientes del vecino (/usuario?view=complaints y el boton del menu). Van
 * con los reclamos del administrador: si el admin no los ve, el vecino no
 * deberia poder abrir uno que nadie va a contestar. Solo Citify: en Countrify
 * el vecino nunca tuvo ese boton.
 */
export const VECINO_RECLAMOS = IADMIN_SECTIONS.reclamos

/**
 * Con las finanzas apagadas, el inicio del administrador muestra el resumen
 * simple (quejas, vecinos, comunicados) en lugar del tablero de cobranzas.
 */
export const IADMIN_FINANZAS =
  IADMIN_SECTIONS.gastos || IADMIN_SECTIONS.cobranzas || IADMIN_SECTIONS.mesaDelMes

export function isIAdminSectionOn(section: IAdminSection): boolean {
  return IADMIN_SECTIONS[section]
}

// Que seccion es cada pagina del panel. El orden importa: la primera regla
// que coincide gana (las de /iadmin/consorcios/[id]/... van antes que la
// del propio /iadmin/consorcios/[id]).
const IADMIN_ROUTES: ReadonlyArray<{ pattern: RegExp; section: IAdminSection }> = [
  { pattern: /^\/iadmin\/gastos(\/|$)/, section: 'gastos' },
  { pattern: /^\/iadmin\/proveedores(\/|$)/, section: 'gastos' },
  { pattern: /^\/iadmin\/cobranzas(\/|$)/, section: 'cobranzas' },
  { pattern: /^\/iadmin\/recordatorios(\/|$)/, section: 'cobranzas' },
  { pattern: /^\/iadmin\/liquidaciones(\/|$)/, section: 'mesaDelMes' },
  { pattern: /^\/iadmin\/cartera(\/|$)/, section: 'mesaDelMes' },
  { pattern: /^\/iadmin\/reportes(\/|$)/, section: 'reportes' },
  { pattern: /^\/iadmin\/expedientes(\/|$)/, section: 'reclamos' },
  { pattern: /^\/iadmin\/comunicaciones(\/|$)/, section: 'comunicados' },
  { pattern: /^\/iadmin\/pizarra(\/|$)/, section: 'pizarra' },
  { pattern: /^\/iadmin\/vecinos(\/|$)/, section: 'vecinos' },
  { pattern: /^\/iadmin\/consorcios\/[^/]+\/vecinos-masivo(\/|$)/, section: 'vecinos' },
  { pattern: /^\/iadmin\/consorcios\/[^/]+\/(gestion|configuracion)(\/|$)/, section: 'datosYUnidades' },
  { pattern: /^\/iadmin\/consorcios\/[^/]+\/cuentas(\/|$)/, section: 'cuentas' },
  { pattern: /^\/iadmin\/consorcios\/[^/]+\/importar(\/|$)/, section: 'importar' },
  { pattern: /^\/iadmin\/consorcios\/[^/]+\/dashboard(\/|$)/, section: 'reportes' },
  { pattern: /^\/iadmin\/consorcios(\/[^/]+)?\/?$/, section: 'mesaDelMes' },
]

/** La seccion a la que pertenece una ruta del panel, o null si no es de ninguna (ej. /iadmin). */
export function iadminSectionForPath(pathname: string): IAdminSection | null {
  return IADMIN_ROUTES.find((r) => r.pattern.test(pathname))?.section ?? null
}

/** A donde mandar a quien entra por link a una pagina apagada. Null = dejar pasar. */
export function redirectForDisabledPath(pathname: string): string | null {
  if (pathname.startsWith('/iadmin')) {
    const section = iadminSectionForPath(pathname)
    return section && !IADMIN_SECTIONS[section] ? '/iadmin' : null
  }
  // /consorcio no: a un administrador lo manda a /iadmin, y a un vecino a
  // /vecino, que cae aca.
  if (!VECINO_EXPENSAS && /^\/(vecino|propietario)(\/|$)/.test(pathname)) {
    return '/usuario'
  }
  return null
}

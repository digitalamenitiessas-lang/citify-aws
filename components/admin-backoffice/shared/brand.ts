// Piezas de color de los paneles de gestion (administrador de consorcio y
// superadmin), para que hablen el mismo idioma: el negro y el naranja de la
// marca. Una sola fuente: si cambia un tono, cambia en todos los paneles.
//
// Mismo diseño que Countrify (countrify-aws, components/admin-backoffice/shared/
// brand.ts) con la paleta de Citify: su azul marino es aca --citify-ink (negro)
// y su arena es --citify-blush (tinte suave del naranja); el activo del sidebar
// va en el naranja de la marca.

/**
 * Sidebar: tarjeta en el negro de la marca, con el item activo en naranja.
 * Igual en tema claro y oscuro, como un logo. Lo usan el sidebar del
 * administrador y el del superadmin.
 */
export const NAV_CARD =
  'flex flex-col gap-1 rounded-2xl bg-[var(--citify-ink)] p-3 text-white dark:ring-1 dark:ring-white/10'
export const NAV_ACTIVE = 'bg-[var(--citify-terracotta)] text-white font-semibold'
export const NAV_IDLE = 'text-white/70 hover:bg-white/10 hover:text-white'
/** Rotulo chico sobre el negro ("Backoffice", "Super administrador"). */
export const NAV_EYEBROW = 'text-[10px] uppercase tracking-wider text-[var(--citify-terracotta)] font-semibold'
/** Separador y titulo de grupo dentro del sidebar ("Consorcios", el edificio activo). */
export const NAV_GROUP = 'mt-3 border-t border-white/10 px-3 pt-3 flex items-center gap-1.5'
export const NAV_GROUP_DOT = 'w-1.5 h-1.5 rounded-full bg-[var(--citify-terracotta)]'
export const NAV_GROUP_LABEL = 'text-[10px] uppercase tracking-wider text-white/55 font-semibold truncate'

/**
 * Encabezado de seccion: fondo naranja muy suave (en tema oscuro, apenas un
 * tinte). No combinar con glass-card: su fondo es CSS global sin capa y pisa a
 * cualquier utilidad de Tailwind.
 */
export const BRAND_HERO =
  'rounded-2xl border border-[color-mix(in_srgb,var(--citify-terracotta)_22%,transparent)] bg-[color-mix(in_srgb,var(--citify-blush)_45%,transparent)] dark:border-[color-mix(in_srgb,var(--citify-terracotta)_25%,transparent)] dark:bg-[color-mix(in_srgb,var(--citify-terracotta)_8%,transparent)]'

/** Chip de icono neutro: tinte naranja con el icono en el naranja oscuro. */
export const BRAND_CHIP = 'bg-[var(--citify-blush)] text-[var(--citify-terracotta-dark)]'

/**
 * Colores de estado para chips de icono y valores: verde bien, ambar atencion,
 * rojo problema. Los -700 solos se leen mal en tema oscuro (el default de la
 * app), asi que cada uno tiene su variante clara.
 */
export const TONE = {
  success: {
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    value: 'text-emerald-700 dark:text-emerald-400',
  },
  warning: {
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    value: 'text-amber-700 dark:text-amber-400',
  },
  danger: {
    chip: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
    value: 'text-rose-700 dark:text-rose-400',
  },
} as const

export type Tone = keyof typeof TONE

/** Sin estado: chip de marca y valor en el color de texto normal. */
export const NEUTRAL = { chip: BRAND_CHIP, value: 'text-foreground' } as const

export function toneStyles(tone?: Tone | null) {
  return tone ? TONE[tone] : NEUTRAL
}

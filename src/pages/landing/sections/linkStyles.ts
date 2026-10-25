/**
 * Classes dos links com cara de botão da landing e das páginas legais (SPEC-20261023-1207). São as mesmas cores do
 * `Button` (tema claro da SPEC-20261023-1204), mas em `<a>`/`<Link>`: navegação é link, não botão.
 * - `primary`: azul-royal cheio com texto branco ("Entrar")
 * - `gold`: dourado com texto marinho ("Abrir o Telão da TV" — dourado nunca leva texto branco)
 * - `secondary`: branco com a borda de controle
 */
import { cn } from '../../../utils/cn'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'

const VARIANTS = {
  primary: 'bg-accent-blue text-white hover:bg-accent-blue-hover focus-visible:ring-accent-blue',
  gold: 'bg-accent-gold text-text-primary hover:bg-accent-gold-hover focus-visible:ring-accent-gold',
  secondary:
    'border border-border-input bg-bg-card text-text-primary hover:bg-bg-tertiary focus-visible:ring-accent-blue',
} as const

const SIZES = {
  md: 'min-h-[44px] px-4 py-2 text-sm',
  lg: 'min-h-[52px] px-6 py-3 text-base',
} as const

export type LinkButtonVariant = keyof typeof VARIANTS

export function linkButton(variant: LinkButtonVariant, size: keyof typeof SIZES = 'md', className?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className)
}

/** Link de texto (azul-royal sublinhado), com alvo de toque confortável. */
export const TEXT_LINK =
  'font-semibold text-accent-blue underline decoration-accent-blue/40 underline-offset-4 hover:decoration-accent-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue rounded-sm'

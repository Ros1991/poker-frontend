import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

/**
 * Chip de status/rótulo. Fundo pastel (`-soft`) com texto na variante `-deep`, a única que passa
 * AA em texto pequeno sobre o pastel (SPEC-20261023-1204).
 *
 * - `gold`: dourado (premiado, campeão, destaque)
 * - `yellow`: alerta — fundo amarelo com texto marinho, porque amarelo nunca vira texto
 * - `gray`: neutro (rascunho, inativo)
 *
 * As tabelas de `constants/statuses.ts` devolvem exatamente estas chaves (`BadgeColor`).
 */
const colorVariants = {
  green: 'bg-accent-green-soft text-accent-green-deep',
  red: 'bg-accent-red-soft text-accent-red-deep',
  yellow: 'bg-accent-yellow-soft text-text-primary',
  gold: 'bg-accent-gold-soft text-accent-gold-deep',
  blue: 'bg-accent-blue-soft text-accent-blue',
  purple: 'bg-accent-purple-soft text-accent-purple-deep',
  orange: 'bg-accent-orange-soft text-accent-orange-deep',
  gray: 'bg-bg-tertiary text-text-secondary',
} as const

/** Chave de cor aceita pelo Badge — é o que `*_STATUS_COLORS` de `constants/statuses.ts` devolve. */
export type BadgeColor = keyof typeof colorVariants

interface BadgeProps {
  children: ReactNode
  color?: BadgeColor
  className?: string
}

export function Badge({ children, color = 'gray', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        colorVariants[color],
        className,
      )}
    >
      {children}
    </span>
  )
}

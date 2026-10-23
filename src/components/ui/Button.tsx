import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../utils/cn'

/**
 * Variantes (SPEC-20261023-1204, tema claro):
 * - `primary`: azul-royal cheio, texto branco
 * - `secondary`: branco com borda `border-input` (≥ 3:1 no branco e no bg-primary: o fundo do botão
 *   é igual ao do card, então a borda é o que mostra que ali tem um botão)
 * - `danger` / `success`: vermelho / verde na variante `-deep` — o texto do botão é pequeno
 *   (14 px) e só o `-deep` passa AA com branco; o hover é o `-hover` da cor
 * - `ghost`: transparente, só texto
 * - `gold`: dourado com texto marinho (CTAs como "Telão da TV"; dourado nunca leva texto branco)
 */
const variants = {
  primary:
    'bg-accent-blue hover:bg-accent-blue-hover text-white focus-visible:ring-accent-blue',
  secondary:
    'bg-bg-card border border-border-input text-text-primary hover:bg-bg-tertiary focus-visible:ring-accent-blue',
  danger:
    'bg-accent-red-deep hover:bg-accent-red-hover text-white focus-visible:ring-accent-red',
  ghost:
    'bg-transparent hover:bg-bg-tertiary text-text-secondary hover:text-text-primary focus-visible:ring-accent-blue',
  success:
    'bg-accent-green-deep hover:bg-accent-green-hover text-white focus-visible:ring-accent-green',
  gold:
    'bg-accent-gold hover:bg-accent-gold-hover text-text-primary focus-visible:ring-accent-gold',
} as const

/** Variante aceita pelo Button. */
export type ButtonVariant = keyof typeof variants

const sizes = {
  sm: 'min-h-[36px] px-3 py-1.5 text-sm',
  md: 'min-h-[44px] px-4 py-2.5 text-sm',
  lg: 'min-h-[52px] px-6 py-3 text-base',
} as const

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: keyof typeof sizes
  loading?: boolean
  children: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'active:scale-[0.98] touch-manipulation',
          variants[variant],
          sizes[size],
          className,
        )}
        disabled={disabled ?? loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{children}</span>
          </>
        ) : (
          children
        )}
      </button>
    )
  },
)

Button.displayName = 'Button'

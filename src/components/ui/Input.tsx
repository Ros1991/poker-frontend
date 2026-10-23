import { forwardRef } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  /**
   * Elemento sobreposto à direita, dentro do campo (ex.: o "olhinho" do PasswordInput).
   * Fica num wrapper `relative` que envolve só o <input> (não o label nem a mensagem de erro),
   * então posicione-o com `absolute inset-y-0 right-0` para acompanhar a altura real do campo.
   * O input ganha `pr-11` automaticamente para o texto não passar por baixo.
   */
  endAdornment?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, endAdornment, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    const field = (
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'min-h-[44px] w-full rounded-lg border bg-bg-input px-3 py-2.5 text-sm text-text-primary',
          'placeholder:text-text-muted',
          'focus:outline-none focus:ring-2 focus:ring-border-focus focus:border-border-focus',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors',
          error
            ? 'border-accent-red focus:ring-accent-red'
            : 'border-border-input',
          endAdornment && 'pr-11',
          className,
        )}
        {...props}
      />
    )

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        {endAdornment ? (
          <div className="relative">
            {field}
            {endAdornment}
          </div>
        ) : (
          field
        )}
        {error && <p className="text-xs text-accent-red-deep">{error}</p>}
        {helperText && !error && (
          <p className="text-xs text-text-secondary">{helperText}</p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'

import { forwardRef, useState } from 'react'
import type { ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from './Input'
import { cn } from '../../utils/cn'

type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type' | 'endAdornment'>

/**
 * Campo de senha com o "olhinho" de mostrar/ocultar. Cada instância alterna sozinha.
 * Aceita todas as props de Input (label, error, autoComplete, ...register()).
 *
 * O botão vai como `endAdornment` do Input: fica num wrapper `relative` só do <input>, com
 * `inset-y-0` — centralizado verticalmente em qualquer altura (fonte grande do navegador, label
 * em duas linhas). Padrão WAI-ARIA de toggle: aria-label fixo + aria-pressed com o estado.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (props, ref) => {
    const [visible, setVisible] = useState(false)

    return (
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        {...props}
        endAdornment={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label="Mostrar senha"
            aria-pressed={visible}
            className={cn(
              // w-11 (44px) × altura do input (≥ 44px) = área de toque mínima
              'absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-lg',
              'text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              'touch-manipulation',
            )}
          >
            {visible ? (
              <EyeOff className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Eye className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        }
      />
    )
  },
)

PasswordInput.displayName = 'PasswordInput'

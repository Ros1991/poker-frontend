import { cn } from '../../utils/cn'

interface AiSwitchProps {
  checked: boolean
  onChange: (next: boolean) => void
  /** Nome lido pelo leitor de tela (ex.: "IA ligada") */
  label: string
  disabled?: boolean
}

/** Liga/desliga (role="switch") com área de toque de 44 × 44 px — SPEC-20261027-1312 */
export function AiSwitch({ checked, onChange, label, disabled = false }: AiSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-[44px] min-w-[52px] shrink-0 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full border transition-colors',
          checked ? 'border-accent-blue bg-accent-blue' : 'border-border-input bg-bg-tertiary',
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            'inline-block h-5 w-5 rounded-full bg-bg-card shadow-sm transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  )
}

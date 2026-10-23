import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: SelectOption[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'min-h-[44px] w-full rounded-lg border bg-bg-input px-3 py-2.5 text-sm text-text-primary',
            'focus:outline-none focus:ring-2 focus:ring-border-focus focus:border-border-focus',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            // Chevron (SVG em text-secondary) e padding à direita vêm da regra global `select` em globals.css
            'transition-colors appearance-none',
            error
              ? 'border-accent-red focus:ring-accent-red'
              : 'border-border-input',
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" className="text-text-muted">
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-accent-red-deep">{error}</p>}
      </div>
    )
  },
)

Select.displayName = 'Select'

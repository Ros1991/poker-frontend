/**
 * Barra de uso de um limite do plano (SPEC-20261023-1205) — "Meu plano" e, depois, a ficha do
 * usuário na administração (SPEC-20261023-1206).
 *
 * API estável:
 * ```tsx
 * <PlanUsageBar label="Home games (como dono)" used={1} limit={1} hint?="..." />
 * ```
 * `limit` null = ilimitado (sem barra, texto "N · ilimitado"). Cheia (used ≥ limit) fica dourada
 * com "Limite do plano atingido."; `limit` 0 sem uso mostra "não incluso no plano" (sem barra); `hint`
 * aparece embaixo (ex.: "O próximo libera em 3 dias").
 */
import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export interface PlanUsageBarProps {
  label: string
  used: number
  limit: number | null
  hint?: ReactNode
  className?: string
}

export function PlanUsageBar({ label, used, limit, hint, className }: PlanUsageBarProps) {
  const unlimited = limit === null
  // Limite 0 = o plano não inclui o recurso (ex.: membros no Mesa): sem barra e sem "atingido"
  const notIncluded = limit === 0 && used === 0
  const full = !unlimited && !notIncluded && used >= limit
  const percent = unlimited ? 0 : limit <= 0 ? 100 : Math.min(100, Math.round((used / limit) * 100))

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-text-primary">{label}</span>
        <span className="shrink-0 tabular-nums text-text-secondary">
          {notIncluded ? (
            'não incluso no plano'
          ) : unlimited ? (
            <>
              <span className="font-semibold text-text-primary">{used}</span> · ilimitado
            </>
          ) : (
            <>
              <span className="font-semibold text-text-primary">{used}</span> de {limit}
            </>
          )}
        </span>
      </div>
      {/* Ilimitado: sem barra (uma trilha vazia pareceria uso zero) */}
      {!unlimited && !notIncluded && (
        <div
          className="h-2 overflow-hidden rounded-full bg-bg-tertiary"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={used}
          aria-valuetext={`${used} de ${limit}`}
        >
          <div
            className={cn('h-full rounded-full', full ? 'bg-accent-gold' : 'bg-accent-blue')}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      {(full || hint) && (
        <p className="text-xs text-text-secondary">
          {full && <span className="font-semibold text-text-primary">Limite do plano atingido. </span>}
          {hint}
        </p>
      )}
    </div>
  )
}

import { ChevronRight, CreditCard, PlusCircle, RefreshCw, Skull } from 'lucide-react'
import type { ReactNode } from 'react'
import { Avatar } from '../ui/Avatar'
import { cn } from '../../utils/cn'
import type { TournamentEntry } from '../../types/entry.types'
import { amountDue, formatCurrency, playerName } from './terminalFormat'

export interface PlayerActionRules {
  canRebuy: boolean
  canAddon: boolean
}

interface PlayerCardProps {
  entry: TournamentEntry
  rules: PlayerActionRules
  onOpen: () => void
  onRebuy: () => void
  onAddon: () => void
  onPay: () => void
  onEliminate: () => void
}

/** "Deve R$ 50,00" em vermelho ou "Pago" em verde */
export function DueLabel({ entry, className }: { entry: TournamentEntry; className?: string }) {
  const due = amountDue(entry)
  return due > 0 ? (
    <span className={cn('font-semibold text-accent-red', className)}>Deve {formatCurrency(due)}</span>
  ) : (
    <span className={cn('font-semibold text-accent-green', className)}>Pago</span>
  )
}

function ActionButton({
  label,
  icon,
  onClick,
  disabled,
  tone = 'default',
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'pay' | 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-semibold transition-colors',
        'touch-manipulation active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35',
        tone === 'default' && 'bg-bg-tertiary text-text-primary',
        tone === 'pay' && 'bg-accent-green/90 text-white',
        tone === 'danger' && 'bg-accent-red/90 text-white',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

/** Card do jogador na tela da mesa: tocar no nome abre a Ficha */
export function PlayerCard({ entry, rules, onOpen, onRebuy, onAddon, onPay, onEliminate }: PlayerCardProps) {
  const name = playerName(entry)
  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary p-2.5">
      <button
        type="button"
        onClick={onOpen}
        className="mb-2 flex w-full items-center gap-2.5 rounded-lg text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-tertiary text-sm font-bold text-text-primary">
          {entry.seatNumber ?? '–'}
        </span>
        <Avatar src={entry.person.photoUrl} name={entry.person.fullName} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-text-primary">{name}</span>
          <span className="block text-xs text-text-muted">
            {entry.rebuyCount > 0 ? `${entry.rebuyCount} rebuy${entry.rebuyCount > 1 ? 's' : ''}` : 'Sem rebuy'}
            {' · '}
            {entry.addonPurchased ? (entry.addonDouble ? 'Add-on duplo' : 'Add-on') : 'Sem add-on'}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-right text-sm">
          <DueLabel entry={entry} />
          <ChevronRight className="h-4 w-4 text-text-muted" />
        </span>
      </button>

      <div className="grid grid-cols-4 gap-1.5">
        <ActionButton label="Rebuy" icon={<RefreshCw className="h-4 w-4" />} onClick={onRebuy} disabled={!rules.canRebuy} />
        <ActionButton label="Add-on" icon={<PlusCircle className="h-4 w-4" />} onClick={onAddon} disabled={!rules.canAddon} />
        <ActionButton label="Pagar" icon={<CreditCard className="h-4 w-4" />} onClick={onPay} tone="pay" />
        <ActionButton label="Eliminar" icon={<Skull className="h-4 w-4" />} onClick={onEliminate} tone="danger" />
      </div>
    </div>
  )
}

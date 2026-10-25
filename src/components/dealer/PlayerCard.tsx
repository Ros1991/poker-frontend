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
  /** Plano do dono com Payments: botão "Pagar" e "Deve/Pago" (SPEC-20261023-1205, D3) */
  showPayment?: boolean
  /** Plano do dono com Tables: etiqueta com o número do lugar sobre a foto */
  showSeat?: boolean
}

/**
 * "Deve R$ 50,00" em vermelho, "Pagou a mais R$ 20,00" em azul (pago acima do devido — a mesma conta do `amountDue`,
 * SPEC-20261023-1217, L13) ou "Pago" em verde (texto pequeno: variante -deep, que passa AA; o azul base já passa)
 */
export function DueLabel({ entry, className }: { entry: TournamentEntry; className?: string }) {
  const due = amountDue(entry)
  if (due > 0)
    return <span className={cn('font-semibold tabular-nums text-accent-red-deep', className)}>Deve {formatCurrency(due)}</span>
  const over = Math.round((entry.totalPaid - entry.totalDue) * 100) / 100
  if (over > 0)
    return (
      <span className={cn('font-semibold tabular-nums text-accent-blue', className)}>Pagou a mais {formatCurrency(over)}</span>
    )
  return <span className={cn('font-semibold text-accent-green-deep', className)}>Pago</span>
}

function ActionButton({
  label,
  ariaLabel,
  icon,
  onClick,
  disabled,
  tone,
  className,
}: {
  label: string
  ariaLabel: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  tone: 'rebuy' | 'addon' | 'pay' | 'danger'
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'flex min-h-[48px] min-w-0 flex-row items-center justify-center gap-1.5 rounded-lg px-1 text-sm font-semibold transition-colors',
        // Abaixo de 360 px o rótulo não cabe ao lado do ícone: volta a ícone sobre rótulo
        'max-[359px]:flex-col max-[359px]:gap-0.5 max-[359px]:text-xs',
        'touch-manipulation active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35',
        // Cores cheias por ação (usado com o polegar e à meia-luz). Rótulo pequeno: verde e
        // vermelho preenchem com a variante -deep, a única que passa AA com texto branco nesse
        // tamanho (a base só serve para texto grande); dourado nunca leva texto branco.
        tone === 'rebuy' && 'bg-accent-blue text-white',
        tone === 'addon' && 'bg-accent-gold text-text-primary',
        tone === 'pay' && 'bg-accent-green-deep text-white',
        tone === 'danger' && 'bg-accent-red-deep text-white',
        className,
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  )
}

/**
 * Card do jogador na tela da mesa (SPEC-20261023-1216, C1–C5): foto redonda grande ocupando a
 * coluna esquerda inteira (iniciais grandes sem foto) com o lugar numa etiqueta sobre ela; à
 * direita o nome, "rebuys · add-on", "Deve/Pago" e a botoeira 2×2 (Rebuy | Add-on / Pagar |
 * Eliminar). Tocar na foto ou no nome abre a Ficha. Sem Payments no plano, some "Pagar" e
 * "Deve/Pago" e Eliminar ocupa a linha de baixo inteira.
 */
export function PlayerCard({
  entry,
  rules,
  onOpen,
  onRebuy,
  onAddon,
  onPay,
  onEliminate,
  showPayment = true,
  showSeat = true,
}: PlayerCardProps) {
  const name = playerName(entry)
  const seat = showSeat ? entry.seatNumber : null
  return (
    <div className="flex gap-2.5 rounded-xl border border-border-default bg-bg-secondary p-2" data-player-card>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Abrir ficha de ${name}`}
        className="flex w-[30%] min-w-[88px] max-w-[128px] shrink-0 items-center justify-center self-stretch rounded-lg"
        data-player-photo
      >
        <span className="relative block w-full">
          <Avatar src={entry.person.photoUrl} name={entry.person.fullName} size="fill" />
          {seat != null && (
            <span
              aria-label={`Lugar ${seat}`}
              className="absolute left-0 top-0 rounded-full border border-border-default bg-bg-card px-2 text-xs font-bold tabular-nums text-text-primary"
            >
              {seat}
            </span>
          )}
        </span>
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 items-center gap-1 rounded-lg text-left"
          data-player-name
        >
          <span className="min-w-0 flex-1 truncate text-lg font-bold leading-tight text-text-primary">{name}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
        </button>
        <div className="flex flex-col text-sm leading-tight">
          <span className="text-text-secondary">
            {entry.rebuyCount > 0 ? `${entry.rebuyCount} rebuy${entry.rebuyCount > 1 ? 's' : ''}` : 'Sem rebuy'}
            {' · '}
            {entry.addonPurchased ? (entry.addonDouble ? 'Add-on duplo' : 'Add-on') : 'Sem add-on'}
          </span>
          {showPayment && <DueLabel entry={entry} />}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <ActionButton
            label="Rebuy"
            ariaLabel={`Rebuy para ${name}`}
            icon={<RefreshCw className="h-5 w-5 shrink-0" />}
            onClick={onRebuy}
            disabled={!rules.canRebuy}
            tone="rebuy"
          />
          <ActionButton
            label="Add-on"
            ariaLabel={`Add-on para ${name}`}
            icon={<PlusCircle className="h-5 w-5 shrink-0" />}
            onClick={onAddon}
            disabled={!rules.canAddon}
            tone="addon"
          />
          {showPayment && (
            <ActionButton
              label="Pagar"
              ariaLabel={`Pagar de ${name}`}
              icon={<CreditCard className="h-5 w-5 shrink-0" />}
              onClick={onPay}
              tone="pay"
            />
          )}
          <ActionButton
            label="Eliminar"
            ariaLabel={`Eliminar ${name}`}
            icon={<Skull className="h-5 w-5 shrink-0" />}
            onClick={onEliminate}
            tone="danger"
            className={showPayment ? undefined : 'col-span-2'}
          />
        </div>
      </div>
    </div>
  )
}

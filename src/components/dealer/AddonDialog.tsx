import { useState } from 'react'
import { Minus, Plus, PlusCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import type { TournamentEntry } from '../../types/entry.types'
import type { Tournament } from '../../types/tournament.types'
import { PlayerConfirmHeader } from './PlayerConfirmHeader'
import { addonsLeft, formatCurrency, playerName } from './terminalFormat'

/** Mesmo limite do servidor por pedido (AddonRules.MaxPerRequest) */
export const MAX_ADDONS_PER_REQUEST = 10

/**
 * Até onde o "+" vai: o que falta para o máximo quando cabe num pedido só ("Cabem até 3"); senão o limite por vez (10)
 * — com o máximo acima de 10 ("Cabem mais 15, até 10 por vez") ou sem limite ("Até 10 por vez"), para o "+" parar em
 * 10 explicado.
 */
function limitHint(left: number | null): string {
  if (left === null) return `Até ${MAX_ADDONS_PER_REQUEST} por vez`
  if (left > MAX_ADDONS_PER_REQUEST) return `Cabem mais ${left}, até ${MAX_ADDONS_PER_REQUEST} por vez`
  return `Cabem até ${left}`
}

interface AddonDialogProps {
  entry: TournamentEntry | null
  tournament: Tournament | undefined
  loading: boolean
  onConfirm: (quantity: number) => void
  onClose: () => void
}

/**
 * Add-on (SPEC-20261027-1311): cada add-on é uma unidade e o jogador compra até o máximo do torneio (0 = sem limite).
 * Quando ainda cabe mais de um, escolhe a quantidade (até o que falta para o máximo, 10 por vez); senão é um só.
 * Confirmação dourada, a cor do Add-on no terminal, com a foto redonda e o nome do jogador no topo (SPEC-20261026-2103).
 */
export function AddonDialog(props: AddonDialogProps) {
  if (!props.entry) return null
  // key: a quantidade volta a 1 a cada jogador
  return <AddonDialogContent key={props.entry.id} {...props} entry={props.entry} />
}

function AddonDialogContent({
  entry,
  tournament,
  loading,
  onConfirm,
  onClose,
}: AddonDialogProps & { entry: TournamentEntry }) {
  const [quantity, setQuantity] = useState(1)
  const unit = tournament?.addonAmount ?? 0
  const max = tournament?.maxAddons ?? 1
  const bought = entry.addonCount ?? 0
  const left = addonsLeft(tournament, entry)
  const cap = Math.max(1, Math.min(left ?? MAX_ADDONS_PER_REQUEST, MAX_ADDONS_PER_REQUEST))
  const qty = Math.min(quantity, cap)
  const status =
    max > 0
      ? `Já comprou ${bought} de ${max} add-on${max > 1 ? 's' : ''}`
      : `Já comprou ${bought} add-on${bought === 1 ? '' : 's'} · sem limite`

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Add-on para ${playerName(entry)}`}
      size="sm"
      footer={
        <Button variant="ghost" className="w-full" disabled={loading} onClick={onClose}>
          Cancelar
        </Button>
      }
    >
      <PlayerConfirmHeader person={entry.person} />
      <p className="mb-3 text-center text-sm text-text-secondary" data-addon-status>
        {status}
      </p>
      {cap > 1 && (
        <div className="mb-3 flex flex-col items-center gap-1.5" data-addon-quantity>
          <span id={`addon-qtd-${entry.id}`} className="text-sm font-medium text-text-secondary">
            Quantos add-ons?
          </span>
          <div className="flex items-center gap-2" role="group" aria-labelledby={`addon-qtd-${entry.id}`}>
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, qty - 1))}
              disabled={qty <= 1 || loading}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border-input bg-bg-input text-text-primary transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:text-text-muted"
              aria-label="Um add-on a menos"
              data-addon-minus
            >
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <span
              className="min-w-[3rem] text-center text-2xl font-bold tabular-nums text-text-primary"
              aria-live="polite"
              data-addon-qty
            >
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(Math.min(cap, qty + 1))}
              disabled={qty >= cap || loading}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border-input bg-bg-input text-text-primary transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:text-text-muted"
              aria-label="Mais um add-on"
              data-addon-plus
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {/* Total e, embaixo, até onde o "+" vai (linhas próprias: nada de palavra solta quebrando no fim) */}
          <span className="flex flex-col items-center text-center text-xs tabular-nums text-text-secondary" data-addon-hint>
            <span data-addon-total>
              {qty} × {formatCurrency(unit)} = {formatCurrency(unit * qty)}
            </span>
            <span data-addon-limit>{limitHint(left)}</span>
          </span>
        </div>
      )}
      <Button
        size="lg"
        variant="gold"
        className="w-full tabular-nums"
        loading={loading}
        onClick={() => onConfirm(qty)}
        data-addon-confirm
      >
        <PlusCircle className="h-5 w-5" />
        {qty === 1 ? 'Confirmar add-on' : `Confirmar ${qty} add-ons`} — {formatCurrency(unit * qty)}
      </Button>
    </Modal>
  )
}

import { PlusCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import type { TournamentEntry } from '../../types/entry.types'
import type { Tournament } from '../../types/tournament.types'
import { formatCurrency, playerName } from './terminalFormat'

interface AddonDialogProps {
  entry: TournamentEntry | null
  tournament: Tournament | undefined
  loading: boolean
  onConfirm: (isDouble: boolean) => void
  onClose: () => void
}

/** Add-on simples ou duplo (duplo só se o torneio permitir). Confirmação dourada, a cor do Add-on no terminal. */
export function AddonDialog({ entry, tournament, loading, onConfirm, onClose }: AddonDialogProps) {
  if (!entry) return null
  const amount = tournament?.addonAmount ?? 0
  return (
    <Modal isOpen onClose={onClose} title={`Add-on para ${playerName(entry)}`} size="sm">
      <div className="flex flex-col gap-2">
        <Button size="lg" variant="gold" className="w-full tabular-nums" loading={loading} onClick={() => onConfirm(false)}>
          <PlusCircle className="h-5 w-5" />
          Add-on simples — {formatCurrency(amount)}
        </Button>
        {tournament?.addonDoubleAllowed && (
          <Button
            size="lg"
            variant="secondary"
            className="w-full tabular-nums"
            loading={loading}
            onClick={() => onConfirm(true)}
          >
            <PlusCircle className="h-5 w-5" />
            Add-on duplo — {formatCurrency(amount * 2)}
          </Button>
        )}
        <Button variant="ghost" className="mt-1 w-full" disabled={loading} onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </Modal>
  )
}

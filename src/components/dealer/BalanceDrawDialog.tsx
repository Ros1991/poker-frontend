import { Shuffle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import type { Table } from '../../api/tables.api'
import type { BalanceMove } from '../../utils/tableBalance'
import { tableLabel } from './terminalFormat'

interface BalanceDrawDialogProps {
  move: BalanceMove
  tables: Table[]
  loading: boolean
  onConfirm: () => void
  onReroll: () => void
  onChooseMyself: () => void
  onClose: () => void
}

/** Mostra o sorteado da mesa mais cheia e o lugar livre da mais vazia */
export function BalanceDrawDialog({
  move,
  tables,
  loading,
  onConfirm,
  onReroll,
  onChooseMyself,
  onClose,
}: BalanceDrawDialogProps) {
  const name = (id: string) => {
    const t = tables.find((x) => x.id === id)
    return t ? tableLabel(t) : 'Mesa'
  }

  return (
    <Modal isOpen onClose={onClose} title="Quem muda de mesa" size="sm">
      <div className="mb-4 rounded-xl bg-bg-primary p-4 text-center">
        <p className="text-2xl font-bold text-text-primary">{move.playerName}</p>
        <p className="mt-2 text-base text-text-secondary">
          {name(move.fromTableId)}, lugar {move.fromSeat}
        </p>
        <p className="text-lg text-accent-blue">↓</p>
        <p className="text-base font-semibold text-accent-green">
          {name(move.toTableId)}, lugar {move.toSeat}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Button size="lg" className="w-full" loading={loading} onClick={onConfirm}>
          Confirmar mudança
        </Button>
        <Button variant="secondary" className="w-full" disabled={loading} onClick={onReroll}>
          <Shuffle className="h-4 w-4" /> Sortear outro
        </Button>
        <button
          type="button"
          onClick={onChooseMyself}
          disabled={loading}
          className="min-h-[44px] text-sm font-medium text-accent-blue"
        >
          Escolher eu mesmo
        </button>
      </div>
    </Modal>
  )
}

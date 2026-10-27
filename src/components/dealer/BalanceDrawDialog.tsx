import { Shuffle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import type { Table } from '../../api/tables.api'
import type { BalanceMove } from '../../utils/tableBalance'
import { PlayerConfirmHeader, type ConfirmPerson } from './PlayerConfirmHeader'
import { tableLabel } from './terminalFormat'

interface BalanceDrawDialogProps {
  move: BalanceMove
  tables: Table[]
  /** Quem foi sorteado (foto e nome) — sem ele, só o nome do sorteio */
  person?: ConfirmPerson | null
  loading: boolean
  onConfirm: () => void
  onReroll: () => void
  onChooseMyself: () => void
  onClose: () => void
}

/**
 * Mostra o sorteado da mesa mais cheia e o lugar livre da mais vazia. Revisão geral 2: confirmação de ação sobre um
 * jogador = PlayerConfirmHeader no topo (foto + nome, SPEC-20261026-2103), com "Mesa A, lugar B → Mesa C, lugar D" na
 * linha de detalhe — o mesmo no painel e no terminal.
 */
export function BalanceDrawDialog({
  move,
  tables,
  person,
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
  const shown: ConfirmPerson = person ?? { fullName: move.playerName, nickname: null, photoUrl: null }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Quem muda de mesa"
      size="sm"
      footer={
        <Button size="lg" className="w-full" loading={loading} onClick={onConfirm}>
          Confirmar mudança
        </Button>
      }
    >
      <PlayerConfirmHeader
        person={shown}
        detail={
          <span data-balance-move>
            {name(move.fromTableId)}, lugar {move.fromSeat} →{' '}
            <span className="font-semibold text-text-primary">
              {name(move.toTableId)}, lugar {move.toSeat}
            </span>
          </span>
        }
      />
      <div className="flex flex-col gap-2">
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

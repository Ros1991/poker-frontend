import { useState } from 'react'
import { Skull } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'
import type { TournamentEntry } from '../../types/entry.types'
import { playerName } from './terminalFormat'

interface EliminateDialogProps {
  entry: TournamentEntry
  /** Jogadores ativos da mesma mesa (candidatos a "quem eliminou") */
  tablemates: TournamentEntry[]
  loading: boolean
  onConfirm: (eliminatedByEntryId?: string) => void
  onClose: () => void
}

/** Montado só quando aberto (a escolha começa sempre em "Pular") */
export function EliminateDialog({ entry, tablemates, loading, onConfirm, onClose }: EliminateDialogProps) {
  const [killerId, setKillerId] = useState<string | null>(null)
  const name = playerName(entry)
  const killer = tablemates.find((e) => e.id === killerId)

  const option = (id: string | null, label: string) => (
    <button
      key={id ?? 'skip'}
      type="button"
      onClick={() => setKillerId(id)}
      className={cn(
        'min-h-[44px] truncate rounded-lg border px-2 text-sm font-medium transition-colors',
        killerId === id
          ? 'border-accent-red bg-accent-red/15 text-text-primary'
          : 'border-border-default bg-bg-primary text-text-secondary',
      )}
    >
      {label}
    </button>
  )

  return (
    <Modal isOpen onClose={onClose} title={`Eliminar ${name}`} size="sm">
      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-2 text-sm font-medium text-text-secondary">Quem eliminou? (opcional)</p>
          <div className="grid max-h-[40vh] grid-cols-2 gap-1.5 overflow-y-auto">
            {option(null, 'Pular')}
            {tablemates.map((e) => option(e.id, playerName(e)))}
          </div>
        </div>

        <Button
          size="lg"
          variant="danger"
          className="w-full"
          loading={loading}
          onClick={() => onConfirm(killerId ?? undefined)}
        >
          <Skull className="h-5 w-5" />
          Eliminar {name}
        </Button>
        <p className="-mt-1 text-center text-xs text-text-muted">
          {killer ? `Quem eliminou: ${playerName(killer)}` : 'Sem informar quem eliminou'}
        </p>
        <Button variant="ghost" className="w-full" disabled={loading} onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </Modal>
  )
}

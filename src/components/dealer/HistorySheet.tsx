import { useState } from 'react'
import { SearchInput } from '../ui/SearchInput'
import type { HistoryItem } from '../../types/history.types'
import type { TournamentEntry } from '../../types/entry.types'
import { HistoryList } from './HistoryList'
import { Sheet } from './Sheet'

interface HistorySheetProps {
  isOpen: boolean
  onClose: () => void
  tournamentId: string
  onUndo: (item: HistoryItem) => Promise<void>
  /** Plano do dono sem Payments: pagamentos sem "Desfazer" (SPEC-20261023-1217, L11) */
  paymentsLocked?: boolean
  /** Inscrições: a confirmação do "Desfazer" mostra a foto do jogador (SPEC-20261026-2103) */
  entries?: TournamentEntry[]
}

/** Tudo que foi feito no torneio, com busca por jogador */
export function HistorySheet({ isOpen, onClose, tournamentId, onUndo, paymentsLocked = false, entries }: HistorySheetProps) {
  const [search, setSearch] = useState('')
  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Histórico"
      toolbar={<SearchInput value={search} onChange={setSearch} placeholder="Buscar jogador" debounceMs={150} />}
    >
      <HistoryList
        tournamentId={tournamentId}
        search={search}
        onUndo={onUndo}
        paymentsLocked={paymentsLocked}
        entries={entries}
      />
    </Sheet>
  )
}

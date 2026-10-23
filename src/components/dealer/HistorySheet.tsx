import { useState } from 'react'
import { SearchInput } from '../ui/SearchInput'
import type { HistoryItem } from '../../types/history.types'
import { HistoryList } from './HistoryList'
import { Sheet } from './Sheet'

interface HistorySheetProps {
  isOpen: boolean
  onClose: () => void
  tournamentId: string
  onUndo: (item: HistoryItem) => Promise<void>
}

/** Tudo que foi feito no torneio, com busca por jogador */
export function HistorySheet({ isOpen, onClose, tournamentId, onUndo }: HistorySheetProps) {
  const [search, setSearch] = useState('')
  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Histórico"
      toolbar={<SearchInput value={search} onChange={setSearch} placeholder="Buscar jogador" debounceMs={150} />}
    >
      <HistoryList tournamentId={tournamentId} search={search} onUndo={onUndo} />
    </Sheet>
  )
}

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
  /**
   * Busca e lista numa coluna centralizada (painel do torneio no computador — SPEC-20261105-1708); no celular a coluna
   * ocupa a largura toda, como no terminal
   */
  centered?: boolean
}

const CENTERED = 'mx-auto w-full max-w-3xl'

/** Tudo que foi feito no torneio, com busca por jogador */
export function HistorySheet({
  isOpen,
  onClose,
  tournamentId,
  onUndo,
  paymentsLocked = false,
  entries,
  centered = false,
}: HistorySheetProps) {
  const [search, setSearch] = useState('')
  const searchInput = <SearchInput value={search} onChange={setSearch} placeholder="Buscar jogador" debounceMs={150} />
  const list = (
    <HistoryList
      tournamentId={tournamentId}
      search={search}
      onUndo={onUndo}
      paymentsLocked={paymentsLocked}
      entries={entries}
    />
  )
  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Histórico"
      toolbar={centered ? <div className={CENTERED}>{searchInput}</div> : searchInput}
    >
      {centered ? <div className={CENTERED}>{list}</div> : list}
    </Sheet>
  )
}

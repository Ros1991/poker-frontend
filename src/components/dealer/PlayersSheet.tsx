import { useMemo, useState } from 'react'
import { ChevronRight, UserPlus } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { SearchInput } from '../ui/SearchInput'
import { cn } from '../../utils/cn'
import type { Table } from '../../api/tables.api'
import type { TournamentEntry } from '../../types/entry.types'
import { DueLabel } from './PlayerCard'
import { Sheet } from './Sheet'
import { isActiveStatus, normalizeText, playerName, seatLabel, statusLabel } from './terminalFormat'

interface PlayersSheetProps {
  isOpen: boolean
  onClose: () => void
  entries: TournamentEntry[]
  tables: Table[] | undefined
  onOpenPlayer: (entry: TournamentEntry) => void
  onAddPlayer: () => void
}

/** Todos os jogadores do torneio: ativos primeiro (por nome), depois eliminados */
export function PlayersSheet({ isOpen, onClose, entries, tables, onOpenPlayer, onAddPlayer }: PlayersSheetProps) {
  const [search, setSearch] = useState('')

  const list = useMemo(() => {
    const term = normalizeText(search.trim())
    return entries
      .filter(
        (e) =>
          !term ||
          normalizeText(e.person.fullName).includes(term) ||
          (e.person.nickname && normalizeText(e.person.nickname).includes(term)),
      )
      .sort((a, b) => {
        const aa = isActiveStatus(a.status) ? 0 : 1
        const bb = isActiveStatus(b.status) ? 0 : 1
        return aa - bb || playerName(a).localeCompare(playerName(b), 'pt-BR')
      })
  }, [entries, search])

  const activeCount = entries.filter((e) => isActiveStatus(e.status)).length

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Jogadores (${activeCount} jogando de ${entries.length})`}
      toolbar={<SearchInput value={search} onChange={setSearch} placeholder="Buscar jogador" debounceMs={150} />}
    >
      <Button variant="secondary" className="mb-3 w-full" onClick={onAddPlayer}>
        <UserPlus className="h-4 w-4" /> Adicionar jogador
      </Button>
      {list.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-secondary">Nenhum jogador encontrado.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {list.map((e) => {
            const active = isActiveStatus(e.status)
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onOpenPlayer(e)}
                  className={cn(
                    // Inativo: fundo zebra e nome em text-secondary, sem opacidade (que derrubava o texto abaixo de AA)
                    'flex min-h-[56px] w-full items-center gap-2.5 rounded-lg border border-border-default p-2 text-left',
                    active ? 'bg-bg-secondary' : 'bg-bg-zebra',
                  )}
                >
                  <Avatar src={e.person.photoUrl} name={e.person.fullName} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm font-semibold', active ? 'text-text-primary' : 'text-text-secondary')}>
                      {playerName(e)}
                    </span>
                    <span className="block truncate text-xs text-text-secondary">
                      {active ? seatLabel(e, tables) : statusLabel(e)}
                    </span>
                  </span>
                  <DueLabel entry={e} className="shrink-0 text-xs" />
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}

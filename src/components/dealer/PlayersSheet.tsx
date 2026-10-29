import { useMemo, useState } from 'react'
import { ChevronRight, UserPlus } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { SearchInput } from '../ui/SearchInput'
import { cn } from '../../utils/cn'
import type { Table } from '../../api/tables.api'
import type { TournamentEntry } from '../../types/entry.types'
import type { KnockoutType } from '../../utils/knockout'
import { BountyLabel, DueLabel, EliminationsLabel } from './PlayerCard'
import { Sheet } from './Sheet'
import { TimebankChip } from './TimebankChip'
import { isActiveStatus, matchesPlayerSearch, playerName, seatLabel, statusLabel } from './terminalFormat'

interface PlayersSheetProps {
  isOpen: boolean
  onClose: () => void
  entries: TournamentEntry[]
  tables: Table[] | undefined
  onOpenPlayer: (entry: TournamentEntry) => void
  onAddPlayer: () => void
  /** Plano do dono com Payments: "Deve/Pago" de cada um (SPEC-20261023-1205, D3) */
  showPayments?: boolean
  /** Plano do dono com Tables: mesa e lugar de cada um */
  showTables?: boolean
  /** Formato do torneio (SPEC-20261026-1909): bounties de cada um */
  knockout?: KnockoutType
  /**
   * Timebank ligado no torneio (SPEC-20261029-1722): o chip "⏱ N" de quem ainda joga, na ponta da linha; tocar abre a
   * TimebankSheet. Ausente = a lista fica como antes.
   */
  timebank?: { onOpen: (entry: TournamentEntry) => void }
}

/** Todos os jogadores do torneio: ativos primeiro (por nome), depois eliminados */
export function PlayersSheet({
  isOpen,
  onClose,
  entries,
  tables,
  onOpenPlayer,
  onAddPlayer,
  showPayments = true,
  showTables = true,
  knockout = 'None',
  timebank,
}: PlayersSheetProps) {
  const [search, setSearch] = useState('')

  const list = useMemo(() => {
    // Mesma busca da aba Jogadores do painel (nome e apelido, sem acento — SPEC-20261023-1217)
    return entries
      .filter((e) => matchesPlayerSearch(e, search))
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
            // Timebank (SPEC-20261029-1722): a linha vira [abrir a Ficha][⏱ N] — dois botões lado a lado, sem aninhar
            const chip = timebank && active
            return (
              <li
                key={e.id}
                className={cn(
                  chip && 'flex items-center gap-1 rounded-lg border border-border-default pr-2',
                  chip && (active ? 'bg-bg-secondary' : 'bg-bg-zebra'),
                )}
              >
                <button
                  type="button"
                  onClick={() => onOpenPlayer(e)}
                  className={cn(
                    // Inativo: fundo zebra e nome em text-secondary, sem opacidade (que derrubava o texto abaixo de AA)
                    'flex min-h-[56px] w-full items-center gap-2.5 rounded-lg p-2 text-left',
                    chip ? 'min-w-0 flex-1' : 'border border-border-default',
                    !chip && (active ? 'bg-bg-secondary' : 'bg-bg-zebra'),
                  )}
                >
                  <Avatar src={e.person.photoUrl} name={e.person.fullName} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm font-semibold', active ? 'text-text-primary' : 'text-text-secondary')}>
                      {playerName(e)}
                    </span>
                    <span className="block truncate text-xs text-text-secondary">
                      {active && showTables ? seatLabel(e, tables) : statusLabel(e)}
                    </span>
                    {/* Quantas pessoas eliminou (SPEC-20261026-1908) — só quando já eliminou alguém */}
                    <EliminationsLabel entry={e} className="flex text-xs" />
                    <BountyLabel entry={e} knockout={knockout} className="flex text-xs" />
                  </span>
                  {showPayments && <DueLabel entry={e} className="shrink-0 text-xs" />}
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
                </button>
                {chip && (
                  <TimebankChip
                    remaining={e.timebanksRemaining ?? 0}
                    onClick={() => timebank.onOpen(e)}
                    playerName={playerName(e)}
                    className="my-0"
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}

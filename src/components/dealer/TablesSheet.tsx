import { Scissors, Shuffle } from 'lucide-react'
import { Button } from '../ui/Button'
import type { Table } from '../../api/tables.api'
import type { TournamentEntry } from '../../types/entry.types'
import { seatedByTable } from '../../utils/tableBalance'
import { Sheet } from './Sheet'
import { isActiveStatus, playerName, tableLabel } from './terminalFormat'

interface TablesOverviewProps {
  tables: Table[]
  entries: TournamentEntry[]
  canBreak: boolean
  onMovePlayer: (entry: TournamentEntry) => void
  onDraw: () => void
  onBreak: () => void
}

interface TablesSheetProps extends TablesOverviewProps {
  isOpen: boolean
  onClose: () => void
}

/** Todas as mesas com os lugares, na tela cheia do terminal; tocar num jogador abre o "Mover" */
export function TablesSheet({ isOpen, onClose, ...rest }: TablesSheetProps) {
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Mesas">
      <TablesOverview {...rest} />
    </Sheet>
  )
}

/**
 * Conteúdo da tela Mesas: sortear (de novo), quebrar mesa e cada mesa com os lugares (tocar num jogador abre o
 * "Mover"). O terminal mostra no `Sheet` (TablesSheet); o painel, numa `Modal` ("Escolher eu mesmo" do sorteio de
 * equilíbrio e os avisos de mesa da aba Jogadores — SPEC-20261026-1908).
 */
export function TablesOverview({ tables, entries, canBreak, onMovePlayer, onDraw, onBreak }: TablesOverviewProps) {
  const seated = seatedByTable(tables, entries)
  const tableIds = new Set(tables.map((t) => t.id))
  const unseated = entries.filter(
    (e) => isActiveStatus(e.status) && (!e.tableId || e.seatNumber == null || !tableIds.has(e.tableId)),
  )

  return (
    <div data-tables-overview>
      <div className="mb-3 flex flex-col gap-2">
        <Button variant={tables.length === 0 ? 'primary' : 'secondary'} className="w-full" onClick={onDraw}>
          <Shuffle className="h-4 w-4" />
          {tables.length === 0 ? 'Sortear mesas' : 'Sortear de novo'}
        </Button>
        {canBreak && (
          <Button variant="secondary" className="w-full" onClick={onBreak}>
            <Scissors className="h-4 w-4" /> Quebrar mesa
          </Button>
        )}
      </div>

      {tables.length > 0 && (
        <p className="mb-2 text-xs text-text-secondary">Toque num jogador para mudar de mesa ou de lugar.</p>
      )}

      <div className="flex flex-col gap-3">
        {tables.map((table) => {
          const players = seated.get(table.id) ?? []
          const bySeat = new Map(players.map((e) => [e.seatNumber, e]))
          return (
            <section key={table.id} className="rounded-xl border border-border-default bg-bg-secondary p-2.5">
              <h3 className="mb-2 flex items-baseline justify-between px-1">
                <span className="font-bold text-text-primary">
                  {tableLabel(table)}
                  {table.isFinalTable && <span className="ml-2 text-xs text-accent-gold-deep">Mesa final</span>}
                </span>
                <span className="text-xs tabular-nums text-text-secondary">
                  {players.length}/{table.maxSeats} jogadores
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {Array.from({ length: table.maxSeats }, (_, i) => i + 1).map((seat) => {
                  const entry = bySeat.get(seat)
                  return entry ? (
                    <button
                      key={seat}
                      type="button"
                      onClick={() => onMovePlayer(entry)}
                      className="flex min-h-[44px] items-center gap-2 rounded-lg bg-bg-tertiary px-2 text-left"
                    >
                      <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-text-secondary">{seat}</span>
                      <span className="truncate text-sm font-medium text-text-primary">{playerName(entry)}</span>
                    </button>
                  ) : (
                    <div
                      key={seat}
                      className="flex min-h-[44px] items-center gap-2 rounded-lg border border-dashed border-border-default px-2"
                    >
                      <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-text-secondary">{seat}</span>
                      <span className="text-sm text-text-secondary">livre</span>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}

        {unseated.length > 0 && (
          <section className="rounded-xl border border-accent-yellow/40 bg-bg-secondary p-2.5">
            <h3 className="mb-2 px-1 font-bold text-text-primary">Sem mesa ({unseated.length})</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {unseated.map((entry) =>
                tables.length > 0 ? (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onMovePlayer(entry)}
                    className="flex min-h-[44px] items-center rounded-lg bg-bg-tertiary px-2 text-left"
                  >
                    <span className="truncate text-sm font-medium text-text-primary">{playerName(entry)}</span>
                  </button>
                ) : (
                  <div key={entry.id} className="flex min-h-[44px] items-center rounded-lg bg-bg-tertiary px-2">
                    <span className="truncate text-sm text-text-primary">{playerName(entry)}</span>
                  </div>
                ),
              )}
            </div>
          </section>
        )}

        {tables.length === 0 && unseated.length === 0 && (
          <p className="py-8 text-center text-sm text-text-secondary">Nenhum jogador no torneio ainda.</p>
        )}
      </div>
    </div>
  )
}

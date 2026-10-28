import { ArrowRightLeft, Scissors, Shuffle } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import type { Table } from '../../api/tables.api'
import type { TournamentEntry } from '../../types/entry.types'
import { cn } from '../../utils/cn'
import { seatedByTable } from '../../utils/tableBalance'
import { useSeatDrag } from '../../pages/tournaments/tabs/useSeatDrag'
import { useSeatDrop } from '../../pages/tournaments/tabs/useSeatDrop'
import { SeatDragGhost } from '../../pages/tournaments/tabs/SeatDragGhost'
import { Sheet } from './Sheet'
import { isActiveStatus, playerName, tableLabel } from './terminalFormat'

interface TablesOverviewProps {
  tournamentId: string
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

/** Todas as mesas com os lugares, na tela cheia do terminal; tocar num jogador abre o "Mover", segurar e arrastar muda de lugar */
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
 * Segurar e arrastar (toque) ou arrastar (mouse) um jogador sentado até outro lugar, como na aba Mesas do painel
 * (SPEC-20261028-1923): vazio move, ocupado troca os dois, fora cancela.
 */
export function TablesOverview({ tournamentId, tables, entries, canBreak, onMovePlayer, onDraw, onBreak }: TablesOverviewProps) {
  const seated = seatedByTable(tables, entries)
  const tableIds = new Set(tables.map((t) => t.id))
  const unseated = entries.filter(
    (e) => isActiveStatus(e.status) && (!e.tableId || e.seatNumber == null || !tableIds.has(e.tableId)),
  )
  const occupantAt = (tableId: string, seat: number) => (seated.get(tableId) ?? []).find((e) => e.seatNumber === seat)
  const nameOf = (entryId: string, fallback: string) => {
    const entry = entries.find((e) => e.id === entryId)
    return entry ? playerName(entry) : fallback
  }
  const tableNameOf = (tableId: string) => {
    const table = tables.find((t) => t.id === tableId)
    return table ? tableLabel(table) : 'Mesa'
  }

  const dropMutation = useSeatDrop({ tournamentId, nameOf, tableNameOf })
  const seatDrag = useSeatDrag((source, target) => {
    if (!tableIds.has(target.tableId)) return
    const occupant = occupantAt(target.tableId, target.seatNumber)
    const other = occupant && occupant.id !== source.entryId ? { id: occupant.id, name: playerName(occupant) } : null
    dropMutation.mutate({ source, target, other })
  })
  const drag = seatDrag.drag
  const dragOther = drag?.target ? occupantAt(drag.target.tableId, drag.target.seatNumber) ?? null : null

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
        <p className="mb-2 text-xs text-text-secondary">
          Toque num jogador para mudar de mesa ou de lugar, ou segure e arraste até outro lugar.
        </p>
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
                  const isSource = !!drag && drag.source.tableId === table.id && drag.source.seatNumber === seat
                  const isTarget = !!drag?.target && drag.target.tableId === table.id && drag.target.seatNumber === seat
                  const seatAttrs = {
                    'data-seat': seat,
                    'data-table-id': table.id,
                    'data-drop-target': isTarget ? (entry ? 'swap' : 'move') : undefined,
                  }
                  return entry ? (
                    <button
                      key={seat}
                      type="button"
                      {...seatAttrs}
                      data-seat-player={entry.id}
                      onPointerDown={(e) =>
                        seatDrag.onPointerDown(e, {
                          entryId: entry.id,
                          name: playerName(entry),
                          photo: entry.person.photoUrl,
                          tableId: table.id,
                          seatNumber: seat,
                        })
                      }
                      onClick={() => {
                        // O clique que vem logo depois de soltar um arrasto não abre nada
                        if (seatDrag.consumeClick()) return
                        onMovePlayer(entry)
                      }}
                      className={cn(
                        // select-none / sem o menu do toque longo: segurar é o começo do arrastar
                        'flex min-h-[44px] select-none items-center gap-2 rounded-lg border border-transparent bg-bg-tertiary px-2 text-left [-webkit-touch-callout:none]',
                        isSource && 'border-dashed border-accent-blue',
                        isTarget && 'border-accent-gold bg-accent-gold-soft ring-2 ring-accent-gold',
                      )}
                    >
                      <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-text-secondary">{seat}</span>
                      <span className="truncate text-sm font-medium text-text-primary">{playerName(entry)}</span>
                    </button>
                  ) : (
                    <div
                      key={seat}
                      {...seatAttrs}
                      className={cn(
                        'flex min-h-[44px] items-center gap-2 rounded-lg border border-dashed border-border-default px-2',
                        isTarget && 'border-solid border-accent-blue bg-accent-blue-soft ring-2 ring-accent-blue',
                      )}
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

      {/* Fantasma de quem está sendo arrastado: segue o dedo/mouse, acima dele (o dedo não cobre), sempre dentro da tela */}
      {drag && (
        <SeatDragGhost x={drag.x} y={drag.y}>
          <Avatar src={drag.source.photo} name={drag.source.name} size="md" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-text-primary">{drag.source.name}</span>
            <span className="flex items-center gap-1 truncate text-xs text-text-secondary">
              {!drag.target ? (
                'Solte num lugar'
              ) : dragOther ? (
                <>
                  <ArrowRightLeft className="h-3 w-3 shrink-0" aria-hidden="true" />
                  Trocar com {playerName(dragOther)}
                </>
              ) : (
                `${tableNameOf(drag.target.tableId)}, lugar ${drag.target.seatNumber}`
              )}
            </span>
          </span>
        </SeatDragGhost>
      )}
    </div>
  )
}

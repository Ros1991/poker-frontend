import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import * as tablesApi from '../../api/tables.api'
import type { Table } from '../../api/tables.api'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { cn } from '../../utils/cn'
import type { TournamentEntry } from '../../types/entry.types'
import { seatedByTable } from '../../utils/tableBalance'
import { apiErrorMessage, playerName, seatLabel, tableLabel } from './terminalFormat'

interface MovePlayerDialogProps {
  tournamentId: string
  entry: TournamentEntry
  tables: Table[]
  entries: TournamentEntry[]
  onClose: () => void
  /** Chamado depois de mover/trocar (quem chama invalida as consultas) */
  onMoved: () => void
}

/** Mover: escolher a mesa → escolher o lugar (livre move; ocupado troca os dois, com confirmação) */
export function MovePlayerDialog({ tournamentId, entry, tables, entries, onClose, onMoved }: MovePlayerDialogProps) {
  const [tableId, setTableId] = useState<string | null>(null)
  const [swapWith, setSwapWith] = useState<{ seat: number; other: TournamentEntry } | null>(null)
  const name = playerName(entry)
  const seated = seatedByTable(tables, entries)
  const table = tables.find((t) => t.id === tableId) ?? null

  const moveMutation = useMutation({
    mutationFn: (vars: { toTableId: string; toSeat: number }) =>
      tablesApi.movePlayer(tournamentId, { entryId: entry.id, ...vars }),
    onSuccess: (_data, vars) => {
      const dest = tables.find((t) => t.id === vars.toTableId)
      const where = `${dest ? tableLabel(dest) : 'Mesa'}, lugar ${vars.toSeat}`
      toast.success(
        swapWith ? `${name} e ${playerName(swapWith.other)} trocaram de lugar` : `${name} foi para ${where}`,
      )
      setSwapWith(null)
      onMoved()
      onClose()
    },
    onError: (err) => {
      setSwapWith(null)
      toast.error(apiErrorMessage(err, 'Erro ao mover jogador.'))
    },
  })

  function pickSeat(seat: number, occupant: TournamentEntry | undefined) {
    if (!table) return
    if (occupant) setSwapWith({ seat, other: occupant })
    else moveMutation.mutate({ toTableId: table.id, toSeat: seat })
  }

  return (
    <>
      <Modal isOpen onClose={onClose} title={`Mover ${name}`} size="sm">
        <p className="mb-3 text-sm text-text-secondary">Hoje: {seatLabel(entry, tables)}</p>

        {!table ? (
          <>
            <p className="mb-2 text-sm font-medium text-text-primary">Para qual mesa?</p>
            <div className="flex flex-col gap-1.5">
              {tables.map((t) => {
                const count = seated.get(t.id)?.length ?? 0
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTableId(t.id)}
                    className={cn(
                      'flex min-h-[48px] items-center justify-between rounded-lg border px-3 text-left',
                      t.id === entry.tableId
                        ? 'border-accent-blue bg-accent-blue-soft'
                        : 'border-border-default bg-bg-primary',
                    )}
                  >
                    <span className="font-semibold text-text-primary">
                      {tableLabel(t)}
                      {t.id === entry.tableId && <span className="ml-2 text-xs text-accent-blue">(atual)</span>}
                    </span>
                    <span className="text-sm tabular-nums text-text-secondary">
                      {count}/{t.maxSeats}
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setTableId(null)}
              className="mb-2 flex min-h-[40px] items-center gap-1 text-sm font-medium text-accent-blue"
            >
              <ArrowLeft className="h-4 w-4" /> Outra mesa
            </button>
            <p className="mb-2 text-sm font-medium text-text-primary">Qual lugar na {tableLabel(table)}?</p>
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: table.maxSeats }, (_, i) => i + 1).map((seat) => {
                const occupant = (seated.get(table.id) ?? []).find((e) => e.seatNumber === seat)
                const isCurrent = occupant?.id === entry.id
                return (
                  <button
                    key={seat}
                    type="button"
                    disabled={isCurrent || moveMutation.isPending}
                    onClick={() => pickSeat(seat, occupant)}
                    className={cn(
                      'flex min-h-[56px] flex-col items-center justify-center rounded-lg border px-1 text-center',
                      'disabled:cursor-not-allowed',
                      isCurrent
                        ? 'border-accent-blue bg-accent-blue-soft'
                        : occupant
                          ? 'border-border-default bg-bg-tertiary'
                          : 'border-accent-green/50 bg-accent-green-soft',
                    )}
                  >
                    <span className="text-xs font-bold tabular-nums text-text-secondary">Lugar {seat}</span>
                    <span
                      className={cn(
                        'w-full truncate text-sm',
                        occupant ? 'text-text-primary' : 'font-semibold text-accent-green-deep',
                      )}
                    >
                      {isCurrent ? 'aqui' : occupant ? playerName(occupant) : 'livre'}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-text-secondary">Lugar livre: muda na hora. Lugar ocupado: troca os dois.</p>
          </>
        )}

        <Button variant="ghost" className="mt-3 w-full" onClick={onClose} disabled={moveMutation.isPending}>
          Cancelar
        </Button>
      </Modal>

      <ConfirmDialog
        isOpen={!!swapWith}
        onClose={() => setSwapWith(null)}
        onConfirm={() => table && swapWith && moveMutation.mutate({ toTableId: table.id, toSeat: swapWith.seat })}
        title="Trocar de lugar"
        message={swapWith ? `Trocar ${name} e ${playerName(swapWith.other)} de lugar?` : ''}
        confirmLabel="Trocar"
        variant="warning"
        loading={moveMutation.isPending}
      />
    </>
  )
}

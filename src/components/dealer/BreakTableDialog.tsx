import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Scissors, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import * as tablesApi from '../../api/tables.api'
import type { BreakTableResult, Table } from '../../api/tables.api'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { cn } from '../../utils/cn'
import type { TournamentEntry } from '../../types/entry.types'
import { seatedByTable } from '../../utils/tableBalance'
import { apiErrorMessage, tableLabel } from './terminalFormat'

interface BreakTableDialogProps {
  tournamentId: string
  tables: Table[]
  entries: TournamentEntry[]
  suggestedTableId: string | null
  onClose: () => void
  /** Chamado assim que a mesa é quebrada (quem chama invalida as consultas) */
  onBroken: (brokenTableId: string) => void
}

/** Quebrar mesa: escolher qual (sugerida marcada) → confirmar → lista de quem foi para onde */
export function BreakTableDialog({
  tournamentId,
  tables,
  entries,
  suggestedTableId,
  onClose,
  onBroken,
}: BreakTableDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(suggestedTableId)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<BreakTableResult | null>(null)

  const seated = seatedByTable(tables, entries)
  const count = (t: Table) => seated.get(t.id)?.length ?? 0
  const totalFree = tables.reduce((sum, t) => sum + Math.max(0, t.maxSeats - count(t)), 0)
  const fits = (t: Table) => count(t) <= totalFree - Math.max(0, t.maxSeats - count(t))
  const selected = tables.find((t) => t.id === selectedId) ?? null

  const breakMutation = useMutation({
    mutationFn: (tableId: string) => tablesApi.breakTable(tournamentId, tableId),
    onSuccess: (data, tableId) => {
      setConfirming(false)
      setResult(data)
      onBroken(tableId)
    },
    onError: (err) => {
      setConfirming(false)
      toast.error(apiErrorMessage(err, 'Erro ao quebrar a mesa.'))
    },
  })

  if (result) {
    return (
      <Modal
        isOpen
        onClose={onClose}
        title={`${result.brokenTableName} quebrada`}
        size="sm"
        footer={
          <Button size="lg" className="w-full" onClick={onClose}>
            Pronto
          </Button>
        }
      >
        {result.finalTable && (
          <p className="mb-3 flex items-center gap-2 rounded-lg bg-accent-gold-soft p-3 text-base font-bold text-accent-gold-deep">
            <Trophy className="h-5 w-5" /> Agora é mesa final!
          </p>
        )}
        <p className="mb-2 text-sm text-text-secondary">Avise os jogadores:</p>
        {result.moves.length === 0 ? (
          <p className="text-sm text-text-secondary">A mesa estava vazia.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {result.moves.map((m) => (
              <li key={m.entryId} className="rounded-lg bg-bg-primary px-3 py-2.5 text-base text-text-primary">
                <span className="font-semibold">{m.playerName}</span> → {m.toTableName}, lugar {m.toSeat}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    )
  }

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        title="Quebrar mesa"
        size="sm"
        footer={
          <div className="flex flex-col gap-1">
            <Button
              size="lg"
              className="w-full"
              disabled={!selected || !fits(selected)}
              onClick={() => setConfirming(true)}
            >
              <Scissors className="h-5 w-5" />
              {selected ? `Quebrar ${tableLabel(selected)}` : 'Escolha a mesa'}
            </Button>
            <Button variant="ghost" className="w-full" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        }
      >
        <p className="mb-2 text-sm text-text-secondary">
          Qual mesa quebrar? Os jogadores dela serão sorteados nos lugares livres das outras.
        </p>
        <div className="flex flex-col gap-1.5">
          {tables.map((t) => {
            const ok = fits(t)
            return (
              <button
                key={t.id}
                type="button"
                disabled={!ok}
                onClick={() => setSelectedId(t.id)}
                className={cn(
                  'flex min-h-[52px] items-center justify-between rounded-lg border px-3 text-left',
                  'disabled:cursor-not-allowed disabled:opacity-40',
                  selectedId === t.id ? 'border-accent-blue bg-accent-blue-soft' : 'border-border-default bg-bg-primary',
                )}
              >
                <span>
                  <span className="block font-semibold text-text-primary">
                    {tableLabel(t)}
                    {t.id === suggestedTableId && <span className="ml-2 text-xs text-accent-blue">(sugerida)</span>}
                  </span>
                  {!ok && <span className="block text-xs text-text-secondary">Não cabem nas outras mesas</span>}
                </span>
                <span className="text-sm tabular-nums text-text-secondary">
                  {count(t)} {count(t) === 1 ? 'jogador' : 'jogadores'}
                </span>
              </button>
            )
          })}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirming && !!selected}
        onClose={() => setConfirming(false)}
        onConfirm={() => selected && breakMutation.mutate(selected.id)}
        title={selected ? `Quebrar ${tableLabel(selected)}?` : 'Quebrar mesa?'}
        message={
          selected
            ? count(selected) === 1
              ? `O jogador da ${tableLabel(selected)} será sorteado num lugar livre das outras mesas.`
              : `Os ${count(selected)} jogadores da ${tableLabel(selected)} serão sorteados nos lugares livres das outras mesas.`
            : ''
        }
        confirmLabel="Quebrar mesa"
        variant="warning"
        loading={breakMutation.isPending}
      />
    </>
  )
}

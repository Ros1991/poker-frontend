import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, Shuffle } from 'lucide-react'
import { toast } from 'sonner'
import * as tablesApi from '../../api/tables.api'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { apiErrorMessage } from './terminalFormat'

interface DrawTablesDialogProps {
  tournamentId: string
  /** Já existem mesas → "Sortear de novo" com confirmação forte */
  hasTables: boolean
  activePlayers: number
  defaultSeats: number
  onClose: () => void
  onDrawn: () => void
}

const REDRAW_WARNING = 'Todos os lugares serão sorteados de novo. Os jogadores vão trocar de mesa e de lugar.'

// Mesmos limites do servidor (TablesController.Draw)
const MIN_SEATS = 2
const MAX_SEATS = 12

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Montado só quando aberto (os campos começam com a sugestão atual) */
export function DrawTablesDialog({
  tournamentId,
  hasTables,
  activePlayers,
  defaultSeats,
  onClose,
  onDrawn,
}: DrawTablesDialogProps) {
  const initialSeats = clamp(defaultSeats, MIN_SEATS, MAX_SEATS)
  const [seats, setSeats] = useState(String(initialSeats))
  const seatsTyped = parseInt(seats)
  const seatsValid = Number.isNaN(seatsTyped) || (seatsTyped >= MIN_SEATS && seatsTyped <= MAX_SEATS)
  const seatsNum = clamp(seatsTyped || initialSeats, MIN_SEATS, MAX_SEATS)
  // Nunca mais mesas que jogadores (o servidor recusa)
  const maxTables = Math.max(1, activePlayers)
  const suggested = clamp(Math.ceil(activePlayers / seatsNum), 1, maxTables)
  // Nº de mesas acompanha a sugestão até o usuário mexer nele
  const [tablesInput, setTablesInput] = useState<string | null>(null)
  const tablesTyped = parseInt(tablesInput ?? '')
  const tablesValid = Number.isNaN(tablesTyped) || (tablesTyped >= 1 && tablesTyped <= maxTables)
  const tableCount = clamp(tablesTyped || suggested, 1, maxTables)
  const [confirmRedraw, setConfirmRedraw] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const drawMutation = useMutation({
    mutationFn: () =>
      tablesApi.draw(tournamentId, { tableCount, maxSeatsPerTable: seatsNum }),
    onSuccess: (created) => {
      toast.success(`Mesas sorteadas: ${created.length} ${created.length === 1 ? 'mesa' : 'mesas'}, ${activePlayers} jogadores`)
      setConfirmRedraw(false)
      onDrawn()
      onClose()
    },
    onError: (err) => {
      setConfirmRedraw(false)
      const message = apiErrorMessage(err, 'Erro ao sortear as mesas.')
      setServerError(message)
      toast.error(message)
    },
  })

  const tooFew = tableCount * seatsNum < activePlayers
  const invalid = !seatsValid || !tablesValid || tooFew

  return (
    <>
      <Modal isOpen onClose={onClose} title={hasTables ? 'Sortear de novo' : 'Sortear mesas'} size="sm">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-secondary">
            {activePlayers} {activePlayers === 1 ? 'jogador ativo' : 'jogadores ativos'}.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Nº de mesas"
              type="number"
              inputMode="numeric"
              min={1}
              max={maxTables}
              value={tablesInput ?? String(suggested)}
              onChange={(e) => {
                setServerError(null)
                setTablesInput(e.target.value)
              }}
            />
            <Input
              label="Lugares por mesa"
              type="number"
              inputMode="numeric"
              min={MIN_SEATS}
              max={MAX_SEATS}
              value={seats}
              onChange={(e) => {
                setServerError(null)
                setSeats(e.target.value)
              }}
            />
          </div>
          {!seatsValid && (
            <p className="text-xs text-accent-red">
              Lugares por mesa: de {MIN_SEATS} a {MAX_SEATS}.
            </p>
          )}
          {!tablesValid && (
            <p className="text-xs text-accent-red">
              Nº de mesas: de 1 a {maxTables} (não pode passar do número de jogadores ativos).
            </p>
          )}
          {seatsValid && tablesValid && tooFew && (
            <p className="text-xs text-accent-red">
              {tableCount} {tableCount === 1 ? 'mesa' : 'mesas'} de {seatsNum} não cabem {activePlayers} jogadores.
            </p>
          )}
          {serverError && (
            <p className="rounded-lg bg-accent-red/10 p-2.5 text-sm text-accent-red">{serverError}</p>
          )}
          {hasTables && (
            <p className="flex items-start gap-2 rounded-lg border border-accent-red/40 bg-accent-red/10 p-2.5 text-sm text-text-primary">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-red" />
              {REDRAW_WARNING}
            </p>
          )}
          <Button
            size="lg"
            variant={hasTables ? 'danger' : 'primary'}
            className="w-full"
            disabled={activePlayers === 0 || invalid}
            loading={drawMutation.isPending && !confirmRedraw}
            onClick={() => (hasTables ? setConfirmRedraw(true) : drawMutation.mutate())}
          >
            <Shuffle className="h-5 w-5" />
            {hasTables ? 'Sortear de novo' : 'Sortear mesas'}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onClose} disabled={drawMutation.isPending}>
            Cancelar
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmRedraw}
        onClose={() => setConfirmRedraw(false)}
        onConfirm={() => drawMutation.mutate()}
        title="Sortear tudo de novo?"
        message={REDRAW_WARNING}
        confirmLabel="Sim, sortear de novo"
        variant="danger"
        loading={drawMutation.isPending}
      />
    </>
  )
}

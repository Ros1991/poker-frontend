import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, Trophy } from 'lucide-react'
import * as entriesApi from '../../api/entries.api'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import type { TournamentEntry } from '../../types/entry.types'

interface EliminationModalProps {
  isOpen: boolean
  onClose: () => void
  entry: TournamentEntry | null
  activeEntries: TournamentEntry[]
  tournamentId: string
  totalEntries: number
}

export function EliminationModal({
  isOpen,
  onClose,
  entry,
  activeEntries,
  tournamentId,
  totalEntries,
}: EliminationModalProps) {
  const queryClient = useQueryClient()
  const [eliminatedBy, setEliminatedBy] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [resultPosition, setResultPosition] = useState<number | null>(null)

  const eliminateMutation = useMutation({
    mutationFn: (vars: { entryId: string; eliminatedByEntryId?: string }) =>
      entriesApi.eliminate(tournamentId, vars.entryId, {
        entryId: vars.entryId,
        eliminatedByEntryId: vars.eliminatedByEntryId,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['entries', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['tables', tournamentId] })
      setResultPosition((data as { position?: number }).position ?? null)
      setShowResult(true)
      toast.success(
        `${entry?.person.nickname ?? entry?.person.fullName} eliminado!`,
      )
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao eliminar jogador.')
    },
  })

  function handleClose() {
    setEliminatedBy('')
    setShowResult(false)
    setResultPosition(null)
    onClose()
  }

  function handleConfirm() {
    if (!entry) return
    eliminateMutation.mutate({
      entryId: entry.id,
      eliminatedByEntryId: eliminatedBy || undefined,
    })
  }

  if (!entry) return null

  const calculatedPosition = activeEntries.length
  const isItm = totalEntries > 0 && calculatedPosition <= Math.ceil(totalEntries * 0.3)

  const otherActive = activeEntries.filter((e) => e.id !== entry.id)

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Eliminar Jogador" size="sm">
      {showResult ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <div
            className={`rounded-full p-4 ${isItm ? 'bg-accent-green/20' : 'bg-bg-tertiary'}`}
          >
            <Trophy
              className={`h-8 w-8 ${isItm ? 'text-accent-green' : 'text-text-muted'}`}
            />
          </div>
          <div className="text-center">
            <p className="font-semibold text-text-primary text-lg">
              {resultPosition ? `${resultPosition}o lugar` : 'Eliminado'}
            </p>
            <p className="text-sm text-text-muted">
              {entry.person.nickname ?? entry.person.fullName}
            </p>
            {isItm && (
              <p className="text-sm font-semibold text-accent-green mt-1">
                ITM! (In The Money)
              </p>
            )}
          </div>
          <Button variant="ghost" onClick={handleClose}>
            Fechar
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3">
            <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-text-primary">
                Confirmar eliminacao
              </p>
              <p className="text-xs text-text-muted">
                {entry.person.nickname ?? entry.person.fullName} sera eliminado
                na posicao {calculatedPosition}o.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Eliminado por (opcional)
            </label>
            <select
              value={eliminatedBy}
              onChange={(e) => setEliminatedBy(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-border-default bg-bg-input px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus"
            >
              <option value="">Selecione...</option>
              {otherActive.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.person.nickname ?? e.person.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={eliminateMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirm}
              loading={eliminateMutation.isPending}
            >
              Confirmar Eliminacao
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Clock,
  Coffee,
  Pencil,
  Plus,
  Trash2,
  Save,
  X,
  Edit as EditIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { tournamentEditPath } from '../../../constants/routes'
import * as timerApi from '../../../api/timer.api'
import * as tournamentBlindsApi from '../../../api/tournamentBlinds.api'
import type { TournamentBlindLevel } from '../../../api/tournamentBlinds.api'
import { Button } from '../../../components/ui/Button'
import { LoadingSpinner } from '../../../components/common/LoadingSpinner'
import type { Tournament } from '../../../types/tournament.types'
import type { TimerState } from '../../../types/blind.types'

interface BlindsTabProps {
  tournament: Tournament
  timerState: TimerState
  syncFromServer: (state: TimerState) => void
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
}

export function BlindsTab({
  tournament,
  timerState,
  syncFromServer,
}: BlindsTabProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  // RT-04: derivar o progresso do timerState recebido por props (antes era uma
  // 2ª instância morta de useBlindTimer que nunca sincronizava → barra travada em 0%)
  const progressPercentage =
    timerState.totalSeconds > 0
      ? ((timerState.totalSeconds - timerState.remainingSeconds) /
          timerState.totalSeconds) *
        100
      : 0

  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState<TournamentBlindLevel[]>([])

  const { data: blindLevels, isLoading: loadingLevels } = useQuery({
    queryKey: ['tournamentBlindLevels', tournament.id],
    queryFn: () =>
      tournamentBlindsApi.getAll(tournament.homeGameId, tournament.id),
  })

  useEffect(() => {
    if (blindLevels && !editMode) {
      setDraft(blindLevels.map((l) => ({ ...l })))
    }
  }, [blindLevels, editMode])

  const saveMutation = useMutation({
    mutationFn: () =>
      tournamentBlindsApi.update(tournament.homeGameId, tournament.id, draft),
    onSuccess: () => {
      toast.success('Blinds atualizados.')
      setEditMode(false)
      queryClient.invalidateQueries({
        queryKey: ['tournamentBlindLevels', tournament.id],
      })
    },
    onError: () => toast.error('Erro ao salvar blinds.'),
  })

  const startMutation = useMutation({
    mutationFn: () => timerApi.start(tournament.id),
    onSuccess: (data) => {
      syncFromServer(data)
      toast.success('Timer iniciado!')
    },
    onError: () => toast.error('Erro ao iniciar timer.'),
  })

  const pauseMutation = useMutation({
    mutationFn: () => timerApi.pause(tournament.id),
    onSuccess: (data) => {
      syncFromServer(data)
      toast.success('Timer pausado.')
    },
    onError: () => toast.error('Erro ao pausar timer.'),
  })

  const resumeMutation = useMutation({
    mutationFn: () => timerApi.resume(tournament.id),
    onSuccess: (data) => {
      syncFromServer(data)
      toast.success('Timer retomado!')
    },
    onError: () => toast.error('Erro ao retomar timer.'),
  })

  const nextMutation = useMutation({
    mutationFn: () => timerApi.nextLevel(tournament.id),
    onSuccess: (data) => {
      syncFromServer(data)
      toast.success('Proximo nivel!')
    },
    onError: () => toast.error('Erro ao avancar nivel.'),
  })

  const prevMutation = useMutation({
    mutationFn: () => timerApi.previousLevel(tournament.id),
    onSuccess: (data) => {
      syncFromServer(data)
      toast.success('Nivel anterior.')
    },
    onError: () => toast.error('Erro ao voltar nivel.'),
  })

  const isAnyLoading =
    startMutation.isPending ||
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    nextMutation.isPending ||
    prevMutation.isPending

  const minutes = Math.floor(timerState.remainingSeconds / 60)
  const seconds = timerState.remainingSeconds % 60
  const localFormattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  function renumber(levels: TournamentBlindLevel[]): TournamentBlindLevel[] {
    return levels.map((l, i) => ({ ...l, levelNumber: i + 1 }))
  }

  function updateDraftLevel(
    index: number,
    patch: Partial<TournamentBlindLevel>,
  ) {
    setDraft((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l
        const updated = { ...l, ...patch }
        // Ao mudar Small Blind, auto-preencher Big Blind com o dobro
        if ('smallBlind' in patch && typeof patch.smallBlind === 'number') {
          updated.bigBlind = patch.smallBlind * 2
        }
        return updated
      }),
    )
  }

  function addLevel() {
    setDraft((prev) => {
      const lastNonBreak = [...prev].reverse().find((l) => !l.isBreak)
      const newLevel: TournamentBlindLevel = {
        levelNumber: prev.length + 1,
        smallBlind: lastNonBreak ? lastNonBreak.bigBlind : 100,
        bigBlind: lastNonBreak ? lastNonBreak.bigBlind * 2 : 200,
        ante: lastNonBreak ? lastNonBreak.ante : 0,
        bigBlindAnte: 0,
        durationMinutes: lastNonBreak ? lastNonBreak.durationMinutes : 20,
        isBreak: false,
        breakDescription: null,
      }
      return renumber([...prev, newLevel])
    })
  }

  function addBreak() {
    setDraft((prev) => {
      const newBreak: TournamentBlindLevel = {
        levelNumber: prev.length + 1,
        smallBlind: 0,
        bigBlind: 0,
        ante: 0,
        bigBlindAnte: 0,
        durationMinutes: 10,
        isBreak: true,
        breakDescription: 'Intervalo',
      }
      return renumber([...prev, newBreak])
    })
  }

  function removeLevel(index: number) {
    setDraft((prev) => renumber(prev.filter((_, i) => i !== index)))
  }

  function cancelEdit() {
    if (blindLevels) setDraft(blindLevels.map((l) => ({ ...l })))
    setEditMode(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Big Timer Display */}
      <div className="rounded-xl border border-border-default bg-bg-primary p-6 text-center">
        {timerState.isBreak ? (
          <div className="flex items-center justify-center gap-2 mb-2">
            <Coffee className="h-5 w-5 text-yellow-400" />
            <span className="text-sm font-semibold text-yellow-400 uppercase">
              Intervalo
            </span>
          </div>
        ) : (
          <p className="text-sm text-text-muted mb-1">
            Nivel {timerState.currentLevel}
          </p>
        )}

        <div className="text-6xl font-mono font-bold text-text-primary mb-2">
          {localFormattedTime}
        </div>

        <div className="w-full bg-bg-tertiary rounded-full h-2 mb-4">
          <div
            className="bg-accent-blue h-2 rounded-full transition-all duration-1000"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {!timerState.isBreak && (
          <div className="flex justify-center gap-8 mb-4">
            <div>
              <p className="text-xs text-text-muted">Small Blind</p>
              <p className="text-2xl font-bold text-text-primary">
                {formatNumber(timerState.smallBlind)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Big Blind</p>
              <p className="text-2xl font-bold text-text-primary">
                {formatNumber(timerState.bigBlind)}
              </p>
            </div>
            {timerState.ante > 0 && (
              <div>
                <p className="text-xs text-text-muted">Ante</p>
                <p className="text-2xl font-bold text-text-primary">
                  {formatNumber(timerState.ante)}
                </p>
              </div>
            )}
          </div>
        )}

        {timerState.nextSmallBlind !== null && (
          <p className="text-xs text-text-muted mb-4">
            Proximo: {formatNumber(timerState.nextSmallBlind!)}/
            {formatNumber(timerState.nextBigBlind!)}
            {timerState.nextAnte ? ` (ante ${formatNumber(timerState.nextAnte)})` : ''}
          </p>
        )}

        <div className="flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => prevMutation.mutate()}
            disabled={isAnyLoading}
            title="Nivel anterior"
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          {!timerState.isRunning ? (
            <Button
              variant="success"
              onClick={() => startMutation.mutate()}
              disabled={isAnyLoading}
            >
              <Play className="h-5 w-5" />
              Iniciar
            </Button>
          ) : timerState.isPaused ? (
            <Button
              variant="success"
              onClick={() => resumeMutation.mutate()}
              disabled={isAnyLoading}
            >
              <Play className="h-5 w-5" />
              Retomar
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => pauseMutation.mutate()}
              disabled={isAnyLoading}
            >
              <Pause className="h-5 w-5" />
              Pausar
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => nextMutation.mutate()}
            disabled={isAnyLoading}
            title="Proximo nivel"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Blind Levels Table */}
      {loadingLevels && <LoadingSpinner text="Carregando blinds..." />}

      {!loadingLevels && blindLevels && (
        <div className="rounded-xl border border-border-default bg-bg-secondary p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                Estrutura de Blinds
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Edite livremente - nao afeta a estrutura padrao
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {!editMode && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(tournamentEditPath(tournament.id))}
                  title="Editar valores (buy-in, rebuy, addon, stack...)"
                >
                  <EditIcon className="h-4 w-4" />
                  Editar Valores
                </Button>
              )}
              {!editMode ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditMode(true)}
                >
                  <Pencil className="h-4 w-4" />
                  Editar Blinds
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={cancelEdit}
                    disabled={saveMutation.isPending}
                  >
                    <X className="h-4 w-4" />
                    Cancelar
                  </Button>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => saveMutation.mutate()}
                    loading={saveMutation.isPending}
                  >
                    <Save className="h-4 w-4" />
                    Salvar
                  </Button>
                </>
              )}
            </div>
          </div>

          {blindLevels.length === 0 && !editMode && (
            <p className="text-sm text-text-muted py-4 text-center">
              Nenhum nivel configurado. Clique em "Editar Blinds" para adicionar.
            </p>
          )}

          {editMode ? (
            <>
              {/* Edit Mode - layout igual ao BlindStructureFormPage */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default text-left text-text-muted">
                      <th className="px-2 py-2 w-16">Nivel</th>
                      <th className="px-2 py-2">Small Blind</th>
                      <th className="px-2 py-2">Big Blind</th>
                      <th className="px-2 py-2">Ante</th>
                      <th className="px-2 py-2 w-24">Duracao (min)</th>
                      <th className="px-2 py-2 w-24">Intervalo?</th>
                      <th className="px-2 py-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.map((level, index) => (
                      <tr
                        key={index}
                        className={`border-b border-border-default ${level.isBreak ? 'bg-accent-blue/5' : ''}`}
                      >
                        <td className="px-2 py-1.5">
                          <span className="text-text-muted font-mono text-xs">
                            {level.levelNumber}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          {level.isBreak ? (
                            <input
                              type="text"
                              value={level.breakDescription ?? ''}
                              onChange={(e) =>
                                updateDraftLevel(index, {
                                  breakDescription: e.target.value,
                                })
                              }
                              placeholder="Intervalo"
                              className="w-full rounded border border-border-default bg-bg-input px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
                            />
                          ) : (
                            <input
                              type="number"
                              value={level.smallBlind}
                              onChange={(e) =>
                                updateDraftLevel(index, {
                                  smallBlind: Number(e.target.value),
                                })
                              }
                              className="w-full rounded border border-border-default bg-bg-input px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
                            />
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          {level.isBreak ? (
                            <span className="text-text-muted text-xs">-</span>
                          ) : (
                            <input
                              type="number"
                              value={level.bigBlind}
                              onChange={(e) =>
                                updateDraftLevel(index, {
                                  bigBlind: Number(e.target.value),
                                })
                              }
                              className="w-full rounded border border-border-default bg-bg-input px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
                            />
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          {level.isBreak ? (
                            <span className="text-text-muted text-xs">-</span>
                          ) : (
                            <input
                              type="number"
                              value={level.ante}
                              onChange={(e) =>
                                updateDraftLevel(index, {
                                  ante: Number(e.target.value),
                                })
                              }
                              className="w-full rounded border border-border-default bg-bg-input px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
                            />
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            value={level.durationMinutes}
                            onChange={(e) =>
                              updateDraftLevel(index, {
                                durationMinutes: Number(e.target.value),
                              })
                            }
                            className="w-full rounded border border-border-default bg-bg-input px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {level.isBreak ? (
                            <Coffee className="h-4 w-4 text-accent-blue mx-auto" />
                          ) : (
                            <span className="text-text-muted text-xs">-</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => removeLevel(index)}
                            className="p-1 rounded text-text-muted hover:text-accent-red hover:bg-red-500/10 transition-colors"
                            title="Remover"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 mt-3">
                <Button type="button" variant="secondary" size="sm" onClick={addLevel}>
                  <Plus className="h-4 w-4" />
                  Adicionar Nivel
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={addBreak}>
                  <Coffee className="h-4 w-4" />
                  Adicionar Intervalo
                </Button>
              </div>
            </>
          ) : (
            blindLevels.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border-default">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-tertiary">
                      <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">
                        Nivel
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-text-muted">
                        SB
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-text-muted">
                        BB
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-text-muted">
                        Ante
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-text-muted">
                        Duracao
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {blindLevels.map((level) => {
                      const isCurrent =
                        level.levelNumber === timerState.currentLevel
                      return (
                        <tr
                          key={level.id ?? level.levelNumber}
                          className={
                            isCurrent
                              ? 'bg-accent-blue/10 border-l-2 border-l-accent-blue'
                              : level.isBreak
                                ? 'bg-gray-500/5'
                                : ''
                          }
                        >
                          <td className="px-3 py-2 font-medium text-text-primary">
                            {level.isBreak ? (
                              <span className="flex items-center gap-1 text-yellow-400">
                                <Coffee className="h-3 w-3" />
                                Intervalo
                              </span>
                            ) : (
                              `Nivel ${level.levelNumber}`
                            )}
                            {isCurrent && (
                              <span className="ml-2 text-xs text-accent-blue">
                                (atual)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-text-primary">
                            {level.isBreak ? '-' : formatNumber(level.smallBlind)}
                          </td>
                          <td className="px-3 py-2 text-right text-text-primary">
                            {level.isBreak ? '-' : formatNumber(level.bigBlind)}
                          </td>
                          <td className="px-3 py-2 text-right text-text-primary">
                            {level.isBreak
                              ? '-'
                              : level.ante > 0
                                ? formatNumber(level.ante)
                                : '-'}
                          </td>
                          <td className="px-3 py-2 text-right text-text-muted">
                            {level.durationMinutes} min
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      {!loadingLevels && !blindLevels && !tournament.blindStructureId && (
        <div className="text-center py-8">
          <Clock className="mx-auto h-10 w-10 text-text-muted mb-3" />
          <p className="text-text-secondary">
            Nenhuma estrutura de blinds configurada.
          </p>
        </div>
      )}
    </div>
  )
}

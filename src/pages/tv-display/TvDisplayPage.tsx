import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Users, Trophy, Clock, Skull } from 'lucide-react'
import * as tournamentsApi from '../../api/tournaments.api'
import * as entriesApi from '../../api/entries.api'
import * as timerApi from '../../api/timer.api'
import * as costExtrasApi from '../../api/costExtras.api'
import * as prizesApi from '../../api/prizes.api'
import { useBlindTimer } from '../../hooks/useBlindTimer'
import { useWebSocket } from '../../hooks/useWebSocket'
import type { TimerState } from '../../types/blind.types'
import type { TournamentEntry } from '../../types/entry.types'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function TvDisplayPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()

  const { data: tournament } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => tournamentsApi.getById(tournamentId!),
    enabled: !!tournamentId,
    refetchInterval: 5000,
  })

  const { data: entries } = useQuery({
    queryKey: ['entries', tournamentId],
    queryFn: () => entriesApi.getAll(tournamentId!),
    enabled: !!tournamentId,
    refetchInterval: 5000,
  })

  const { data: costExtras } = useQuery({
    queryKey: ['costExtras', tournamentId],
    queryFn: () => costExtrasApi.getAll(tournamentId!),
    enabled: !!tournamentId,
    refetchInterval: 10000,
  })

  // Calcular premiação para mostrar valores das posições
  const { data: prizeData } = useQuery({
    queryKey: ['prizes', tournamentId],
    queryFn: () => prizesApi.calculate(tournamentId!),
    enabled: !!tournamentId,
    refetchInterval: 10000,
  })

  const { timerState, syncFromServer, formattedTime, progressPercentage } =
    useBlindTimer()

  // Initial fetch of timer state (and periodic refresh as fallback)
  useQuery({
    queryKey: ['timer', tournamentId],
    queryFn: async () => {
      const state = await timerApi.getState(tournamentId!)
      syncFromServer(state as TimerState)
      return state
    },
    enabled: !!tournamentId,
    refetchInterval: 15000,
  })

  useWebSocket({
    tournamentId: tournamentId ?? '',
    enabled: !!tournamentId,
    onTimerUpdate: (state) => syncFromServer(state as TimerState),
  })

  // Auto fullscreen
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          void document.documentElement.requestFullscreen()
        } else {
          void document.exitFullscreen()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const activeEntries =
    entries?.filter((e: TournamentEntry) => e.status === 'Active' || e.status === 'Registered') ?? []
  const eliminatedEntries =
    entries
      ?.filter((e: TournamentEntry) => e.status === 'Eliminated' || e.status === 'Awarded')
      .sort(
        (a: TournamentEntry, b: TournamentEntry) =>
          (a.finalPosition ?? 999) - (b.finalPosition ?? 999),
      ) ?? []

  // Ultimo eliminado = o mais recente (por timestamp eliminatedAt)
  // Posicoes funcionam ao contrario: o primeiro a ser eliminado tem a MAIOR posicao numerica
  const lastEliminated = eliminatedEntries.length > 0
    ? [...eliminatedEntries].sort((a, b) => {
        const aTime = a.eliminatedAt ? new Date(a.eliminatedAt).getTime() : 0
        const bTime = b.eliminatedAt ? new Date(b.eliminatedAt).getTime() : 0
        return bTime - aTime
      })[0]
    : null

  // Premiacao = total das entries - custos
  const totalDue = entries?.reduce((sum, e) => sum + (e.totalDue ?? 0), 0) ?? 0
  const totalCosts = costExtras?.reduce((sum, c) => sum + (c.amount ?? 0), 0) ?? 0
  const premiacao = totalDue - totalCosts

  // Ja tem premiados? (jogadores eliminados em posicao premiada)
  const prizesList = prizeData?.prizes ?? []
  const awardedEntries = eliminatedEntries.filter(
    (e) => e.finalPosition && prizesList.some((p) => p.position === e.finalPosition),
  )
  const lastAwarded = awardedEntries.length > 0
    ? [...awardedEntries].sort((a, b) => {
        const aTime = a.eliminatedAt ? new Date(a.eliminatedAt).getTime() : 0
        const bTime = b.eliminatedAt ? new Date(b.eliminatedAt).getTime() : 0
        return bTime - aTime
      })[0]
    : null

  // Proxima premiacao (se ninguem foi premiado ainda)
  const nextPrizePosition = prizesList.length > 0
    ? prizesList[prizesList.length - 1].position
    : null
  const nextPrizeAmount = prizesList.length > 0
    ? prizesList[prizesList.length - 1].amount
    : 0

  // Status label
  const statusLabels: Record<string, { label: string; color: string }> = {
    Draft: { label: 'Rascunho', color: 'bg-gray-500/20 text-gray-300' },
    OpenForRegistration: { label: 'Iniciado', color: 'bg-blue-500/20 text-blue-400' },
    InProgress: { label: 'Iniciado', color: 'bg-blue-500/20 text-blue-400' },
    BreakSettlement: { label: 'Rebuys Finalizados', color: 'bg-yellow-500/20 text-yellow-400' },
    Finished: { label: 'Finalizado', color: 'bg-emerald-500/20 text-emerald-400' },
    Cancelled: { label: 'Cancelado', color: 'bg-red-500/20 text-red-400' },
  }
  const statusInfo = tournament ? statusLabels[tournament.status] ?? { label: tournament.status, color: 'bg-gray-500/20 text-gray-300' } : null

  const timerColor =
    timerState.remainingSeconds <= 60
      ? 'text-red-400'
      : timerState.remainingSeconds <= 120
        ? 'text-yellow-400'
        : 'text-emerald-400'

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white overflow-hidden select-none">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a0f1c] via-[#0d1529] to-[#0a1628]" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.08),transparent_60%)]" />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Top Bar */}
        <header className="flex items-center justify-between border-b border-white/10 px-8 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight">
              {tournament?.name ?? 'Torneio'}
            </h1>
            {statusInfo && (
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <span>Pressione F para tela cheia</span>
            <span>
              {new Date().toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8 py-6">
          {tournament?.status === 'Finished' ? (
            (() => {
              const champion = entries
                ?.slice()
                .sort((a, b) => (a.finalPosition ?? 999) - (b.finalPosition ?? 999))
                .find((e) => e.finalPosition === 1)
                ?? entries?.find((e) => e.status === 'Awarded')
              const name =
                champion?.person.nickname ?? champion?.person.fullName ?? '—'
              return (
                <div className="flex flex-col items-center gap-4">
                  <span className="text-3xl font-semibold uppercase tracking-[0.3em] text-yellow-400">
                    Campeão
                  </span>
                  <div
                    className="text-center font-bold text-white text-[7rem] leading-none"
                    style={{
                      textShadow:
                        '0 0 80px rgba(234,179,8,0.5), 0 0 30px rgba(234,179,8,0.3)',
                    }}
                  >
                    {name}
                  </div>
                  {champion?.prizeAmount ? (
                    <div className="text-3xl font-semibold text-emerald-400">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(champion.prizeAmount)}
                    </div>
                  ) : null}
                </div>
              )
            })()
          ) : (
          /* Blind Level + Timer */
          <div className="flex flex-col items-center gap-2">
            {timerState.isBreak ? (
              <div className="rounded-full bg-yellow-500/20 px-6 py-2 text-lg font-semibold text-yellow-400">
                INTERVALO
              </div>
            ) : (
              <div className="flex items-center gap-3 text-slate-400">
                <Clock className="h-5 w-5" />
                <span className="text-lg font-medium">
                  Nivel {timerState.currentLevel}
                </span>
              </div>
            )}

            {/* Timer */}
            <div
              className={`font-mono text-[10rem] font-bold leading-none tracking-tighter transition-colors duration-500 ${timerColor}`}
              style={{
                textShadow: `0 0 80px ${timerState.remainingSeconds <= 60 ? 'rgba(239,68,68,0.3)' : timerState.remainingSeconds <= 120 ? 'rgba(234,179,8,0.3)' : 'rgba(34,197,94,0.3)'}`,
              }}
            >
              {formattedTime}
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-2xl h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-1000 ease-linear"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>

            {/* Blinds Info */}
            <div className="mt-4 flex items-center gap-8">
              <div className="flex flex-col items-center">
                <span className="text-sm text-slate-500 uppercase tracking-wider">
                  Blinds
                </span>
                <span className="text-4xl font-bold text-white">
                  {timerState.smallBlind.toLocaleString('pt-BR')} /{' '}
                  {timerState.bigBlind.toLocaleString('pt-BR')}
                </span>
              </div>
              {timerState.ante > 0 && (
                <div className="flex flex-col items-center">
                  <span className="text-sm text-slate-500 uppercase tracking-wider">
                    Ante
                  </span>
                  <span className="text-4xl font-bold text-orange-400">
                    {timerState.ante.toLocaleString('pt-BR')}
                  </span>
                </div>
              )}
              {timerState.nextSmallBlind != null && (
                <div className="flex flex-col items-center opacity-60">
                  <span className="text-sm text-slate-500 uppercase tracking-wider">
                    Proximo
                  </span>
                  <span className="text-2xl font-semibold text-slate-300">
                    {timerState.nextSmallBlind.toLocaleString('pt-BR')} /{' '}
                    {timerState.nextBigBlind?.toLocaleString('pt-BR')}
                  </span>
                </div>
              )}
            </div>
          </div>
          )}
        </div>

        {/* Bottom Section - Info Cards */}
        <div className="grid grid-cols-4 gap-4 border-t border-white/10 px-8 py-6">
          {/* Players */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <span className="text-sm font-medium text-slate-400">
                Jogadores
              </span>
            </div>
            <p className="text-4xl font-bold">
              <span className="text-emerald-400">
                {activeEntries.length}
              </span>
              <span className="text-slate-500 text-2xl">
                {' '}
                / {tournament?.totalEntries ?? 0}
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {tournament?.totalRebuys ?? 0} rebuys |{' '}
              {tournament?.totalAddons ?? 0} add-ons
            </p>
          </div>

          {/* Premiação */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20">
                <Trophy className="h-5 w-5 text-emerald-400" />
              </div>
              <span className="text-sm font-medium text-slate-400">
                Premiação
              </span>
            </div>
            <p className="text-4xl font-bold text-emerald-400">
              {formatCurrency(premiacao)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Custos: {formatCurrency(totalCosts)}
            </p>
          </div>

          {/* Ultimo Eliminado */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20">
                <Skull className="h-5 w-5 text-red-400" />
              </div>
              <span className="text-sm font-medium text-slate-400">
                Ultimo Eliminado
              </span>
            </div>
            {lastEliminated ? (
              <>
                <p className="text-2xl font-bold text-white truncate">
                  {lastEliminated.person.nickname ?? lastEliminated.person.fullName}
                </p>
                <p className="mt-1 text-lg text-red-400">
                  {lastEliminated.finalPosition}º lugar
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">Nenhum eliminado ainda</p>
            )}
          </div>

          {/* Premiados / Proxima premiacao */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/20">
                <Trophy className="h-5 w-5 text-yellow-400" />
              </div>
              <span className="text-sm font-medium text-slate-400">
                {lastAwarded ? 'Ultimo Premiado' : 'Proxima Premiacao'}
              </span>
            </div>
            {lastAwarded ? (
              <>
                <p className="text-2xl font-bold text-white truncate">
                  {lastAwarded.person.nickname ?? lastAwarded.person.fullName}
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-lg text-yellow-400">
                    {lastAwarded.finalPosition}º
                  </span>
                  {(() => {
                    const prize = prizesList.find((p) => p.position === lastAwarded.finalPosition)
                    return prize ? (
                      <span className="text-lg font-semibold text-emerald-400">
                        {formatCurrency(prize.amount)}
                      </span>
                    ) : null
                  })()}
                </div>
              </>
            ) : nextPrizePosition ? (
              <>
                <p className="text-2xl font-bold text-white">
                  {nextPrizePosition}º lugar
                </p>
                <p className="mt-1 text-lg font-semibold text-emerald-400">
                  {formatCurrency(nextPrizeAmount)}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">Sem premiação calculada</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

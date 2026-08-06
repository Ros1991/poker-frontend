import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Users, Trophy, Clock, Skull, Coins, Hourglass, LayoutGrid } from 'lucide-react'
import * as tournamentsApi from '../../api/tournaments.api'
import * as entriesApi from '../../api/entries.api'
import * as tablesApi from '../../api/tables.api'
import * as timerApi from '../../api/timer.api'
import * as costExtrasApi from '../../api/costExtras.api'
import * as prizesApi from '../../api/prizes.api'
import * as tournamentBlindsApi from '../../api/tournamentBlinds.api'
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

// O backend envia TimerStateResponse (durationMinutes + nextLevel aninhado);
// o TimerState local espera totalSeconds e campos planos de próximo nível.
interface RawTimerResponse {
  currentLevel?: number | null
  smallBlind?: number
  bigBlind?: number
  ante?: number
  durationMinutes?: number
  remainingSeconds?: number
  isRunning?: boolean
  isBreak?: boolean
  nextLevel?: {
    levelNumber?: number
    smallBlind?: number
    bigBlind?: number
    ante?: number
    isBreak?: boolean
  } | null
}

function toTimerState(raw: unknown): TimerState {
  const r = (raw ?? {}) as RawTimerResponse
  return {
    currentLevel: r.currentLevel ?? 1,
    smallBlind: r.smallBlind ?? 0,
    bigBlind: r.bigBlind ?? 0,
    ante: r.ante ?? 0,
    remainingSeconds: r.remainingSeconds ?? 0,
    totalSeconds: (r.durationMinutes ?? 0) * 60,
    isRunning: r.isRunning ?? false,
    isPaused: false,
    nextSmallBlind: r.nextLevel && !r.nextLevel.isBreak ? (r.nextLevel.smallBlind ?? null) : null,
    nextBigBlind: r.nextLevel && !r.nextLevel.isBreak ? (r.nextLevel.bigBlind ?? null) : null,
    nextAnte: r.nextLevel && !r.nextLevel.isBreak ? (r.nextLevel.ante ?? null) : null,
    isBreak: r.isBreak ?? false,
  }
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const SCROLL_GAP = 16

// Lista que rola verticalmente em loop infinito QUANDO o conteúdo estoura o
// container; caso contrário fica estática (ancorada embaixo se anchorBottom).
function AutoScrollList({
  children,
  className = '',
  speed = 26,
  anchorBottom = false,
}: {
  children: ReactNode
  className?: string
  speed?: number
  anchorBottom?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scrollPx, setScrollPx] = useState(0)

  useEffect(() => {
    function measure() {
      const container = containerRef.current
      const content = contentRef.current
      if (!container || !content) return
      const overflows = content.scrollHeight > container.clientHeight + 2
      setScrollPx(overflows ? content.scrollHeight + SCROLL_GAP : 0)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    if (contentRef.current) ro.observe(contentRef.current)
    return () => ro.disconnect()
  }, [children])

  const scrolling = scrollPx > 0
  return (
    <div
      ref={containerRef}
      className={`overflow-hidden ${scrolling ? '' : anchorBottom ? 'flex flex-col justify-end' : ''} ${className}`}
    >
      <div
        style={
          scrolling
            ? ({
                animation: `tv-scroll ${Math.max(8, scrollPx / speed)}s linear infinite`,
                '--tv-scroll-h': `${scrollPx}px`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <div ref={contentRef}>{children}</div>
        {scrolling && (
          <div aria-hidden style={{ paddingTop: SCROLL_GAP }}>
            {children}
          </div>
        )}
      </div>
    </div>
  )
}

export function TvDisplayPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const queryClient = useQueryClient()

  // Alternância entre o telão normal (relógio) e a grade de mesas/assentos
  const [view, setView] = useState<'clock' | 'tables'>('clock')

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

  // Mesas com assentos (visão "Ver Mesas")
  const { data: tables } = useQuery({
    queryKey: ['tables', tournamentId],
    queryFn: () => tablesApi.getAll(tournamentId!),
    enabled: !!tournamentId,
    refetchInterval: 10000,
  })

  // Níveis de blind do torneio — para calcular o tempo até o próximo intervalo
  const { data: blindLevels } = useQuery({
    queryKey: ['blindLevels', tournamentId],
    queryFn: () => tournamentBlindsApi.getAll(tournament!.homeGameId, tournamentId!),
    enabled: !!tournamentId && !!tournament?.homeGameId,
    refetchInterval: 60000,
  })

  const { timerState, syncFromServer, formattedTime, progressPercentage } =
    useBlindTimer(() => {
      void queryClient.invalidateQueries({ queryKey: ['timer', tournamentId] })
    })

  // Initial fetch of timer state (and periodic refresh as fallback)
  useQuery({
    queryKey: ['timer', tournamentId],
    queryFn: async () => {
      const state = await timerApi.getState(tournamentId!)
      syncFromServer(toTimerState(state))
      return state
    },
    enabled: !!tournamentId,
    refetchInterval: 15000,
  })

  useWebSocket({
    tournamentId: tournamentId ?? '',
    enabled: !!tournamentId,
    onTimerUpdate: (state) => syncFromServer(toTimerState(state)),
  })

  // Relógio de parede (coluna direita)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Auto fullscreen (F) + alternar telão/mesas (M)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          void document.documentElement.requestFullscreen()
        } else {
          void document.exitFullscreen()
        }
      }
      if (e.key === 'm' || e.key === 'M') {
        setView((v) => (v === 'clock' ? 'tables' : 'clock'))
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const activeEntries =
    entries?.filter((e: TournamentEntry) => e.status === 'Active' || e.status === 'Registered') ?? []
  const eliminatedEntries =
    entries
      ?.filter((e: TournamentEntry) => e.status === 'Eliminated' || e.status === 'Awarded' || e.status === 'PaidOut')
      .sort(
        (a: TournamentEntry, b: TournamentEntry) =>
          (a.finalPosition ?? 999) - (b.finalPosition ?? 999),
      ) ?? []

  // Lista da coluna esquerda AGRUPADA POR MESA: "Mesa N" → jogadores por assento,
  // ativos sem assento em "Sem mesa", eliminados por último. Sem mesas → lista plana.
  const sortedTables = [...(tables ?? [])].sort((a, b) => a.tableNumber - b.tableNumber)
  const playerGroups: {
    key: string
    label: string | null
    players: TournamentEntry[]
  }[] = []
  if (sortedTables.length > 0) {
    for (const table of sortedTables) {
      const seated = activeEntries
        .filter((e) => e.tableId === table.id)
        .sort((a, b) => (a.seatNumber ?? 99) - (b.seatNumber ?? 99))
      if (seated.length > 0) {
        playerGroups.push({
          key: table.id,
          label: table.tableName ?? `Mesa ${table.tableNumber}`,
          players: seated,
        })
      }
    }
    const tableIds = new Set(sortedTables.map((t) => t.id))
    const unseated = activeEntries.filter(
      (e) => !e.tableId || !tableIds.has(e.tableId),
    )
    if (unseated.length > 0) {
      playerGroups.push({ key: 'sem-mesa', label: 'Sem mesa', players: unseated })
    }
    if (eliminatedEntries.length > 0) {
      playerGroups.push({
        key: 'eliminados',
        label: 'Eliminados',
        players: eliminatedEntries,
      })
    }
  } else {
    const flat = [...activeEntries, ...eliminatedEntries]
    if (flat.length > 0) playerGroups.push({ key: 'todos', label: null, players: flat })
  }
  const totalListedPlayers = playerGroups.reduce((s, g) => s + g.players.length, 0)

  // Premiacao = total das entries - custos
  const totalDue = entries?.reduce((sum, e) => sum + (e.totalDue ?? 0), 0) ?? 0
  const totalCosts = costExtras?.reduce((sum, c) => sum + (c.amount ?? 0), 0) ?? 0
  const premiacao = totalDue - totalCosts

  const prizesList = prizeData?.prizes ?? []

  // Fichas em jogo (por entry: stack inicial + rebuys + addon; addon duplo = 2x)
  // + bônus de pontualidade (qtd de jogadores × fichas de bônus)
  const startingStack = tournament?.startingStack ?? 0
  const rebuyStack = tournament?.rebuyStack ?? startingStack
  const addonStack = tournament?.addonStack ?? startingStack
  const bonusChipsTotal =
    (tournament?.punctualityBonusCount ?? 0) * (tournament?.punctualityBonusChips ?? 0)
  const totalChips =
    (entries?.reduce((sum, e) => {
      const rebuyChips = (e.rebuyCount ?? 0) * rebuyStack
      const addonChips = e.addonPurchased ? (e.addonDouble ? 2 : 1) * addonStack : 0
      return sum + startingStack + rebuyChips + addonChips
    }, 0) ?? 0) + bonusChipsTotal
  const avgStack = activeEntries.length > 0 ? Math.round(totalChips / activeEntries.length) : 0

  // Apelido por personId (pra grade de mesas usar o mesmo nome do resto do telão)
  const nicknameByPersonId = new Map(
    (entries ?? []).map((e) => [e.personId, e.person.nickname ?? e.person.fullName]),
  )

  // Tempo até o próximo intervalo: restante do nível atual + níveis até o break
  let secondsToBreak: number | null = null
  if (!timerState.isBreak && blindLevels && blindLevels.length > 0) {
    const nextBreak = blindLevels
      .filter((l) => l.isBreak && l.levelNumber > timerState.currentLevel)
      .sort((a, b) => a.levelNumber - b.levelNumber)[0]
    if (nextBreak) {
      let secs = timerState.remainingSeconds
      for (const l of blindLevels) {
        if (!l.isBreak && l.levelNumber > timerState.currentLevel && l.levelNumber < nextBreak.levelNumber) {
          secs += l.durationMinutes * 60
        }
      }
      secondsToBreak = secs
    }
  }

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

  function renderBalance(e: TournamentEntry) {
    if (e.balance > 0) {
      return <span className="font-semibold text-red-400">{formatCurrency(e.balance)}</span>
    }
    if (e.balance < 0) {
      return <span className="font-semibold text-blue-400">{formatCurrency(e.balance)}</span>
    }
    return <span className="font-semibold text-emerald-400">Pago</span>
  }

  return (
    <div className="h-screen bg-[#0a0f1c] text-white overflow-hidden select-none">
      <style>{`@keyframes tv-scroll { from { transform: translateY(0); } to { transform: translateY(calc(-1 * var(--tv-scroll-h))); } }`}</style>
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a0f1c] via-[#0d1529] to-[#0a1628]" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.08),transparent_60%)]" />

      <div className="relative z-10 flex h-screen flex-col">
        {/* Top Bar */}
        <header className="flex items-center justify-between border-b border-white/10 px-6 py-3">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight">
              {tournament?.name ?? 'Torneio'}
            </h1>
            {statusInfo && (
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-6 text-base text-slate-400">
            <span>Pressione F para tela cheia</span>
            <span>
              {now.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <button
              type="button"
              onClick={() => setView(view === 'clock' ? 'tables' : 'clock')}
              className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-base font-semibold text-white transition-colors hover:bg-white/20"
              title="Também alterna com a tecla M"
            >
              {view === 'clock' ? (
                <>
                  <LayoutGrid className="h-5 w-5" />
                  Ver Mesas
                </>
              ) : (
                <>
                  <Clock className="h-5 w-5" />
                  Voltar ao Telão
                </>
              )}
            </button>
          </div>
        </header>

        {/* Main: visão de MESAS (onde sentar) ou o telão de 3 colunas.
            Assentos exibem o APELIDO (consistente com o resto do telão),
            resolvido via entries; fallback pro nome vindo da API de mesas. */}
        {view === 'tables' ? (
          <div className="min-h-0 flex-1 overflow-hidden px-6 py-4">
            {tables && tables.length > 0 ? (
              <AutoScrollList className="h-full min-h-0" speed={20}>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(22rem,1fr))] gap-4">
                  {[...tables]
                    .sort((a, b) => a.tableNumber - b.tableNumber)
                    .map((table) => (
                      <div
                        key={table.id}
                        className="rounded-xl border border-white/10 bg-white/5 p-5"
                      >
                        <div className="mb-3 flex items-baseline justify-between gap-2">
                          <h3 className="text-3xl font-bold text-white">
                            {table.tableName ?? `Mesa ${table.tableNumber}`}
                          </h3>
                          {table.dealerName && (
                            <span className="truncate text-base text-slate-400">
                              Dealer:{' '}
                              <span className="font-semibold text-slate-200">
                                {table.dealerName}
                              </span>
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {Array.from({ length: table.maxSeats }, (_, i) => i + 1).map(
                            (seat) => {
                              const p = table.players?.find(
                                (pl) => pl.seatNumber === seat,
                              )
                              return (
                                <div
                                  key={seat}
                                  className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-xl ${
                                    p ? 'bg-white/5' : 'opacity-35'
                                  }`}
                                >
                                  <span className="w-8 shrink-0 text-right font-mono font-bold text-blue-400">
                                    {seat}
                                  </span>
                                  <span
                                    className={`truncate font-semibold ${
                                      p ? 'text-white' : 'text-slate-500'
                                    }`}
                                  >
                                    {p ? (nicknameByPersonId.get(p.personId) ?? p.name) : 'vago'}
                                  </span>
                                </div>
                              )
                            },
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </AutoScrollList>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
                <LayoutGrid className="h-12 w-12" />
                <p className="text-2xl">Mesas ainda não sorteadas.</p>
              </div>
            )}
          </div>
        ) : (
        <div className="grid flex-1 min-h-0 grid-cols-[1fr_2fr_1fr] gap-4 px-6 py-4">
          {/* ==== Coluna esquerda: jogadores ==== */}
          <aside className="flex min-h-0 flex-col rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-blue-400" />
                <h2 className="text-2xl font-semibold text-slate-200">Jogadores</h2>
              </div>
              <p className="text-2xl font-bold">
                <span className="text-emerald-400">{activeEntries.length}</span>
                <span className="text-slate-500"> / {entries?.length ?? 0}</span>
              </p>
            </div>
            <p className="mb-2 text-base text-slate-500">
              {tournament?.totalRebuys ?? 0} rebuys | {tournament?.totalAddons ?? 0} add-ons
            </p>
            <div className="mb-1 grid grid-cols-[minmax(0,1fr)_3rem_3rem_8rem] gap-1 px-2 text-sm uppercase tracking-wider text-slate-500">
              <span>Jogador</span>
              <span className="text-center">Reb</span>
              <span className="text-center">Add</span>
              <span className="text-right">Deve</span>
            </div>
            <AutoScrollList className="min-h-0 flex-1">
              <div className="flex flex-col gap-1">
                {playerGroups.map((group) => (
                  <div key={group.key} className="flex flex-col gap-1">
                    {group.label && (
                      <div className="mt-2 flex items-center gap-2 px-2 first:mt-0">
                        <span className="text-lg font-bold uppercase tracking-wider text-blue-400">
                          {group.label}
                        </span>
                        <span className="h-px flex-1 bg-white/10" />
                      </div>
                    )}
                    {group.players.map((e) => {
                  const finished = e.status !== 'Active' && e.status !== 'Registered'
                  const isChampion = finished && e.finalPosition === 1
                  return (
                    <div
                      key={e.id}
                      className={`grid grid-cols-[minmax(0,1fr)_3rem_3rem_8rem] items-center gap-1 rounded-lg px-2 py-2 text-xl ${
                        isChampion
                          ? 'border border-yellow-500/30 bg-yellow-500/10'
                          : finished
                            ? 'bg-white/[0.03] opacity-60'
                            : 'border border-white/10 bg-white/5'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        {isChampion ? (
                          <span className="flex shrink-0 items-center gap-1 font-bold text-yellow-400">
                            <Trophy className="h-5 w-5" />
                            1º
                          </span>
                        ) : finished ? (
                          <span className="flex shrink-0 items-center gap-1 font-bold text-red-400">
                            <Skull className="h-5 w-5" />
                            {e.finalPosition ? `${e.finalPosition}º` : ''}
                          </span>
                        ) : null}
                        <span className={`truncate font-semibold ${isChampion ? 'text-white' : finished ? 'text-slate-400' : 'text-white'}`}>
                          {e.person.nickname ?? e.person.fullName}
                        </span>
                      </span>
                      <span className="text-center text-slate-300">{e.rebuyCount || '-'}</span>
                      <span className="text-center text-slate-300">
                        {e.addonPurchased ? (e.addonDouble ? '2' : '1') : '-'}
                      </span>
                      <span className="text-right">{renderBalance(e)}</span>
                    </div>
                  )
                })}
                  </div>
                ))}
                {totalListedPlayers === 0 && (
                  <p className="py-6 text-center text-sm text-slate-500">Nenhum jogador inscrito.</p>
                )}
              </div>
            </AutoScrollList>
          </aside>

          {/* ==== Coluna central: timer / blinds / campeão ==== */}
          <div className="flex min-h-0 flex-col items-center justify-center gap-6">
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
                    <span className="text-4xl font-semibold uppercase tracking-[0.3em] text-yellow-400">
                      Campeão
                    </span>
                    <div
                      className="max-w-full break-words text-center text-[6rem] font-bold leading-none text-white"
                      style={{
                        textShadow:
                          '0 0 80px rgba(234,179,8,0.5), 0 0 30px rgba(234,179,8,0.3)',
                      }}
                    >
                      {name}
                    </div>
                    {champion?.prizeAmount ? (
                      <div className="text-4xl font-semibold text-emerald-400">
                        {formatCurrency(champion.prizeAmount)}
                      </div>
                    ) : null}
                  </div>
                )
              })()
            ) : (
              <div className="flex flex-col items-center gap-2">
                {timerState.isBreak ? (
                  <div className="rounded-full bg-yellow-500/20 px-8 py-2 text-2xl font-semibold text-yellow-400">
                    INTERVALO
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-slate-400">
                    <Clock className="h-6 w-6" />
                    <span className="text-2xl font-medium">
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
                <div className="h-2 w-full max-w-xl overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>

                {/* Blinds Info — fonte grande */}
                <div className="mt-4 flex flex-col items-center gap-3">
                  <div className="flex items-end gap-10">
                    <div className="flex flex-col items-center">
                      <span className="text-lg uppercase tracking-wider text-slate-500">
                        Blinds
                      </span>
                      <span className="text-8xl font-bold text-white">
                        {timerState.smallBlind.toLocaleString('pt-BR')} /{' '}
                        {timerState.bigBlind.toLocaleString('pt-BR')}
                      </span>
                    </div>
                    {timerState.ante > 0 && (
                      <div className="flex flex-col items-center">
                        <span className="text-lg uppercase tracking-wider text-slate-500">
                          Ante
                        </span>
                        <span className="text-7xl font-bold text-orange-400">
                          {timerState.ante.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    )}
                  </div>
                  {timerState.nextSmallBlind != null && (
                    <div className="flex flex-col items-center opacity-70">
                      <span className="text-base uppercase tracking-wider text-slate-500">
                        Proximo
                      </span>
                      <span className="text-4xl font-semibold text-slate-300">
                        {timerState.nextSmallBlind.toLocaleString('pt-BR')} /{' '}
                        {timerState.nextBigBlind?.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ==== Coluna direita: hora / fichas / intervalo / premiação ==== */}
          <aside className="flex min-h-0 flex-col gap-3">
            {/* Hora atual */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-1 flex items-center gap-2 text-slate-400">
                <Clock className="h-5 w-5" />
                <span className="text-base font-medium uppercase tracking-wider">Hora</span>
              </div>
              <p className="font-mono text-6xl font-bold text-white">
                {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>

            {/* Fichas */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-1 flex items-center gap-2 text-slate-400">
                <Coins className="h-5 w-5" />
                <span className="text-base font-medium uppercase tracking-wider">Fichas em jogo</span>
              </div>
              <p className="text-5xl font-bold text-white">
                {totalChips.toLocaleString('pt-BR')}
              </p>
              <p className="mt-1 text-xl text-slate-400">
                Média por jogador:{' '}
                <span className="font-semibold text-emerald-400">
                  {avgStack.toLocaleString('pt-BR')}
                </span>
              </p>
            </div>

            {/* Próximo intervalo */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-1 flex items-center gap-2 text-slate-400">
                <Hourglass className="h-5 w-5" />
                <span className="text-base font-medium uppercase tracking-wider">Próximo intervalo</span>
              </div>
              <p className="font-mono text-5xl font-bold text-yellow-400">
                {timerState.isBreak
                  ? 'Agora'
                  : secondsToBreak != null
                    ? formatDuration(secondsToBreak)
                    : '—'}
              </p>
            </div>

            {/* Premiação por posição — o mais abaixo possível */}
            <div className="mt-auto flex min-h-0 flex-col rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                  <Trophy className="h-5 w-5 text-yellow-400" />
                  <span className="text-base font-medium uppercase tracking-wider">Premiação</span>
                </div>
                <span className="text-xl font-bold text-emerald-400">{formatCurrency(premiacao)}</span>
              </div>
              <AutoScrollList className="min-h-0" anchorBottom>
                <div className="flex flex-col gap-1">
                  {prizesList.map((p) => {
                    const winner = eliminatedEntries.find((e) => e.finalPosition === p.position)
                    return (
                      <div
                        key={p.position}
                        className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2 py-2 text-xl"
                      >
                        <span className="w-12 shrink-0 font-bold text-yellow-400">{p.position}º</span>
                        <span className="shrink-0 font-semibold text-emerald-400">
                          {formatCurrency(p.amount)}
                        </span>
                        {winner && (
                          <span className="min-w-0 flex-1 truncate text-right text-slate-400">
                            {winner.person.nickname ?? winner.person.fullName}
                          </span>
                        )}
                      </div>
                    )
                  })}
                  {prizesList.length === 0 && (
                    <p className="py-3 text-center text-base text-slate-500">Sem premiação calculada</p>
                  )}
                </div>
              </AutoScrollList>
            </div>
          </aside>
        </div>
        )}
      </div>
    </div>
  )
}

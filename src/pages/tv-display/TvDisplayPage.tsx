import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Users, Trophy, Clock, Skull, Coins, Hourglass, LayoutGrid, ArrowLeft } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { buildPixPayload } from '../../utils/pix'
import * as publicDisplayApi from '../../api/publicDisplay.api'
import { useBlindTimer } from '../../hooks/useBlindTimer'
import { pairDisplayPath } from '../../constants/routes'
import { formatPairingCode } from '../../utils/pairingCode'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { BrandLogo } from '../../components/brand/BrandLogo'
import { TOURNAMENT_STATUS_COLORS, TOURNAMENT_STATUS_LABELS } from '../../constants/statuses'
import type { TimerState } from '../../types/blind.types'
import type { TvEntry } from '../../types/display.types'
import type { TournamentStatus } from '../../types/tournament.types'

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

interface TvDisplayPageProps {
  deviceToken: string
  /** Código do QR pequeno "trocar torneio" (renovado sozinho pelo servidor) */
  pairingCode: string | null
  /** Botão Voltar: sai do torneio e volta para o QR grande */
  onLeave: () => void
  /** O torneio deixou de estar disponível (ex.: cancelado) */
  onUnpaired: () => void
}

export function TvDisplayPage({ deviceToken, pairingCode, onLeave, onUnpaired }: TvDisplayPageProps) {
  const queryClient = useQueryClient()

  // Alternância entre o telão normal (relógio) e a grade de mesas/assentos
  const [view, setView] = useState<'clock' | 'tables'>('clock')

  // Tudo que o telão mostra numa consulta só, sem login (token do aparelho)
  const { data: snapshot, error: snapshotError } = useQuery({
    queryKey: ['tv-snapshot', deviceToken],
    queryFn: () => publicDisplayApi.getSnapshot(deviceToken),
    refetchInterval: 3000,
    retry: (count, error) =>
      !(axios.isAxiosError(error) && error.response?.status === 409) && count < 2,
  })

  const unpaired = axios.isAxiosError(snapshotError) && snapshotError.response?.status === 409
  useEffect(() => {
    if (unpaired) onUnpaired()
  }, [unpaired, onUnpaired])

  const tournament = snapshot?.tournament
  const entries = snapshot?.entries
  const tables = snapshot?.tables
  const blindLevels = snapshot?.blindLevels

  const { timerState, syncFromServer, formattedTime, progressPercentage } =
    useBlindTimer(() => {
      void queryClient.invalidateQueries({ queryKey: ['tv-snapshot', deviceToken] })
    })

  // Sincroniza o relógio só quando o servidor diz algo novo (nível, pausa ou
  // desvio de 2s+); ressincronizar a cada consulta faria o segundo "pular".
  const lastSyncRef = useRef<{ state: TimerState; at: number } | null>(null)
  useEffect(() => {
    if (!snapshot?.timer) return
    const next = toTimerState(snapshot.timer)
    const last = lastSyncRef.current
    if (last) {
      const expected = last.state.isRunning
        ? last.state.remainingSeconds - Math.floor((Date.now() - last.at) / 1000)
        : last.state.remainingSeconds
      const same =
        last.state.currentLevel === next.currentLevel &&
        last.state.isRunning === next.isRunning &&
        last.state.isBreak === next.isBreak &&
        last.state.smallBlind === next.smallBlind &&
        last.state.bigBlind === next.bigBlind &&
        Math.abs(expected - next.remainingSeconds) < 2
      if (same) return
    }
    lastSyncRef.current = { state: next, at: Date.now() }
    syncFromServer(next)
  }, [snapshot, syncFromServer])

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
    entries?.filter((e: TvEntry) => e.status === 'Active' || e.status === 'Registered') ?? []
  const eliminatedEntries =
    entries
      ?.filter((e: TvEntry) => e.status === 'Eliminated' || e.status === 'Awarded' || e.status === 'PaidOut')
      .sort(
        (a: TvEntry, b: TvEntry) =>
          (a.finalPosition ?? 999) - (b.finalPosition ?? 999),
      ) ?? []

  // Lista da coluna esquerda AGRUPADA POR MESA: "Mesa N" → jogadores por assento,
  // ativos sem assento em "Sem mesa", eliminados por último. Sem mesas → lista plana.
  const sortedTables = [...(tables ?? [])].sort((a, b) => a.tableNumber - b.tableNumber)
  const playerGroups: {
    key: string
    label: string | null
    players: TvEntry[]
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

  // Premiação calculada no servidor: confirmada = soma dos prêmios salvos;
  // não confirmada = arrecadado - custos (estimativa ao vivo)
  const prizesList = snapshot?.prizes ?? []
  const premiacao = snapshot?.prizePool ?? 0

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
    (entries ?? []).map((e) => [e.personId, e.displayName]),
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

  // Status do torneio: rótulo e cor vêm da tabela única de statuses.ts (o snapshot manda string)
  const status = tournament?.status
  const knownStatus =
    status && status in TOURNAMENT_STATUS_LABELS ? (status as TournamentStatus) : null

  // Relógio: marinho; dourado-deep no último minuto; vermelho nos 30 s finais
  const timerColor =
    timerState.remainingSeconds <= 30
      ? 'text-accent-red'
      : timerState.remainingSeconds <= 60
        ? 'text-accent-gold-deep'
        : 'text-text-primary'

  function renderBalance(e: TvEntry) {
    if (e.balance > 0) {
      return <span className="font-semibold tabular-nums text-accent-red-deep">{formatCurrency(e.balance)}</span>
    }
    if (e.balance < 0) {
      return <span className="font-semibold tabular-nums text-accent-blue">{formatCurrency(e.balance)}</span>
    }
    return <span className="font-semibold text-accent-green-deep">Pago</span>
  }

  return (
    <div className="h-screen bg-bg-primary text-text-primary overflow-hidden select-none">
      <style>{`@keyframes tv-scroll { from { transform: translateY(0); } to { transform: translateY(calc(-1 * var(--tv-scroll-h))); } }`}</style>
      {/* Marca d'água: a marca gráfica (/brand/marca-grafica.png, via BrandLogo) fixa no centro a 8 %,
          só aqui no telão pareado; os cards brancos das colunas passam por cima dela. A 8 % o pior pixel
          (contorno preto da arte) vira o cinza R225 G227 B230 atrás da coluna central: text-primary 10.6:1,
          accent-blue 5.3:1, text-secondary 4.2:1 — por isso todo texto solto ali é grande (≥ 24 px). */}
      <BrandLogo
        variant="mark"
        decorative
        className="pointer-events-none fixed left-1/2 top-1/2 z-0 h-[60vh] -translate-x-1/2 -translate-y-1/2 opacity-[0.08]"
      />

      <div className="relative z-10 flex h-screen flex-col">
        {/* Top Bar */}
        <header className="flex items-center justify-between border-b border-border-default bg-bg-card px-6 py-3">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight">
              {tournament?.name ?? 'Torneio'}
            </h1>
            {status && (
              <Badge
                color={knownStatus ? TOURNAMENT_STATUS_COLORS[knownStatus] : 'gray'}
                className="px-3 py-1 text-sm"
              >
                {knownStatus ? TOURNAMENT_STATUS_LABELS[knownStatus] : status}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-5 text-base text-text-secondary">
            <span>Pressione F para tela cheia</span>
            <span>
              {now.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setView(view === 'clock' ? 'tables' : 'clock')}
              className="text-base font-semibold"
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
            </Button>
            {pairingCode && (
              <div
                className="flex items-center gap-3 rounded-lg border border-border-default bg-bg-card py-1.5 pl-1.5 pr-3"
                title="Leia com o celular logado para mostrar outro torneio"
              >
                <div className="rounded bg-white p-1">
                  <QRCodeSVG
                    value={`${window.location.origin}${pairDisplayPath(pairingCode)}`}
                    size={56}
                  />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs uppercase tracking-wider text-text-secondary">Trocar torneio</span>
                  <span className="font-mono text-lg font-bold tracking-widest text-text-primary tabular-nums">
                    {formatPairingCode(pairingCode)}
                  </span>
                </div>
              </div>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={onLeave}
              className="text-base font-semibold"
              title="Sai deste torneio e volta para o QR grande"
            >
              <ArrowLeft className="h-5 w-5" />
              Voltar
            </Button>
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
                        className="rounded-xl border border-border-default bg-bg-card p-5"
                      >
                        <div className="mb-3 flex items-baseline justify-between gap-2">
                          <h3 className="text-3xl font-bold text-text-primary">
                            {table.tableName ?? `Mesa ${table.tableNumber}`}
                          </h3>
                          {table.dealerName && (
                            <span className="truncate text-base text-text-secondary">
                              Dealer:{' '}
                              <span className="font-semibold text-text-primary">
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
                                    p ? 'border border-transparent bg-bg-tertiary' : 'border border-dashed border-border-default'
                                  }`}
                                >
                                  {/* Assento vago: sem opacidade (deixava o texto abaixo de 2:1); o
                                      tracejado e o cinza text-secondary (5.4:1) já marcam que está livre */}
                                  <span
                                    className={`w-8 shrink-0 text-right font-mono font-bold tabular-nums ${
                                      p ? 'text-accent-blue' : 'text-text-secondary'
                                    }`}
                                  >
                                    {seat}
                                  </span>
                                  <span
                                    className={`truncate ${
                                      p ? 'font-semibold text-text-primary' : 'italic text-text-secondary'
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
              <div className="flex h-full flex-col items-center justify-center gap-3 text-text-secondary">
                <LayoutGrid className="h-12 w-12" />
                <p className="text-2xl">Mesas ainda não sorteadas.</p>
              </div>
            )}
          </div>
        ) : (
        <div className="grid flex-1 min-h-0 grid-cols-[1fr_2fr_1fr] gap-4 px-6 py-4">
          {/* ==== Coluna esquerda: jogadores ==== */}
          <aside className="flex min-h-0 flex-col rounded-xl border border-border-default bg-bg-card p-4">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-accent-blue" />
                <h2 className="text-2xl font-semibold text-text-primary">Jogadores</h2>
              </div>
              <p className="text-2xl font-bold tabular-nums">
                <span className="text-accent-green-deep">{activeEntries.length}</span>
                <span className="text-text-secondary"> / {entries?.length ?? 0}</span>
              </p>
            </div>
            <p className="mb-2 text-base tabular-nums text-text-secondary">
              {tournament?.totalRebuys ?? 0} rebuys | {tournament?.totalAddons ?? 0} add-ons
            </p>
            <div className="mb-1 grid grid-cols-[minmax(0,1fr)_3rem_3rem_8rem] gap-1 px-2 text-sm uppercase tracking-wider text-text-secondary">
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
                        <span className="text-lg font-bold uppercase tracking-wider text-accent-blue">
                          {group.label}
                        </span>
                        <span className="h-px flex-1 bg-border-default" />
                      </div>
                    )}
                    {group.players.map((e) => {
                  const finished = e.status !== 'Active' && e.status !== 'Registered'
                  const isChampion = finished && e.finalPosition === 1
                  return (
                    <div
                      key={e.id}
                      className={`grid items-center gap-1 rounded-lg px-2 py-2 text-xl ${
                        finished
                          ? 'grid-cols-[minmax(0,1fr)_8rem]'
                          : 'grid-cols-[minmax(0,1fr)_3rem_3rem_8rem]'
                      } ${
                        isChampion
                          ? 'border border-accent-gold/40 bg-accent-gold-soft'
                          : finished
                            ? 'bg-bg-zebra'
                            : 'border border-border-default bg-bg-primary'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        {isChampion ? (
                          <span className="flex shrink-0 items-center gap-1 font-bold text-accent-gold-deep">
                            <Trophy className="h-5 w-5" />
                            1º
                          </span>
                        ) : finished ? (
                          <span className="flex shrink-0 items-center gap-1 font-bold tabular-nums text-accent-red-deep">
                            <Skull className="h-5 w-5" />
                            {e.finalPosition ? `${e.finalPosition}º` : ''}
                          </span>
                        ) : null}
                        <span className={`truncate font-semibold ${finished && !isChampion ? 'text-text-secondary' : 'text-text-primary'}`}>
                          {e.displayName}
                        </span>
                      </span>
                      {!finished && (
                        <>
                          <span className="text-center tabular-nums text-text-secondary">{e.rebuyCount || '-'}</span>
                          <span className="text-center tabular-nums text-text-secondary">
                            {e.addonPurchased ? (e.addonDouble ? '2' : '1') : '-'}
                          </span>
                        </>
                      )}
                      <span className="text-right">{renderBalance(e)}</span>
                    </div>
                  )
                })}
                  </div>
                ))}
                {totalListedPlayers === 0 && (
                  <p className="py-6 text-center text-sm text-text-secondary">Nenhum jogador inscrito.</p>
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
                const name = champion?.displayName ?? '—'
                return (
                  <div className="flex max-w-full flex-col items-center gap-4 rounded-2xl border border-accent-gold/40 bg-accent-gold-soft px-12 py-8">
                    <span className="text-4xl font-semibold uppercase tracking-[0.3em] text-accent-gold-deep">
                      Campeão
                    </span>
                    <div className="max-w-full break-words text-center text-[6rem] font-bold leading-none text-text-primary">
                      {name}
                    </div>
                    {champion?.prizeAmount ? (
                      <div className="text-4xl font-semibold tabular-nums text-accent-green-deep">
                        {formatCurrency(champion.prizeAmount)}
                      </div>
                    ) : null}
                  </div>
                )
              })()
            ) : (
              <div className="flex flex-col items-center gap-2">
                {timerState.isBreak ? (
                  <div className="rounded-full bg-accent-gold-soft px-8 py-2 text-2xl font-semibold text-accent-gold-deep">
                    INTERVALO
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-accent-blue">
                    <Clock className="h-6 w-6" />
                    <span className="text-2xl font-medium">
                      Nível {timerState.currentLevel}
                    </span>
                  </div>
                )}

                {/* Timer */}
                <div
                  className={`font-mono tabular-nums text-[10rem] font-bold leading-none tracking-tighter transition-colors duration-500 ${timerColor}`}
                >
                  {formattedTime}
                </div>

                {/* Progress Bar */}
                <div className="h-2 w-full max-w-xl overflow-hidden rounded-full bg-border-default">
                  <div
                    className="h-full rounded-full bg-accent-blue transition-all duration-1000 ease-linear"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>

                {/* Blinds Info — fonte grande */}
                <div className="mt-4 flex flex-col items-center gap-3">
                  <div className="flex items-end gap-10">
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-semibold uppercase tracking-wider text-text-secondary">
                        Blinds
                      </span>
                      <span className="text-8xl font-bold tabular-nums text-accent-blue">
                        {timerState.smallBlind.toLocaleString('pt-BR')} /{' '}
                        {timerState.bigBlind.toLocaleString('pt-BR')}
                      </span>
                    </div>
                    {timerState.ante > 0 && (
                      <div className="flex flex-col items-center">
                        <span className="text-2xl font-semibold uppercase tracking-wider text-text-secondary">
                          Ante
                        </span>
                        <span className="text-7xl font-bold tabular-nums text-accent-orange-deep">
                          {timerState.ante.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    )}
                  </div>
                  {timerState.nextSmallBlind != null && (
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-semibold uppercase tracking-wider text-text-secondary">
                        Próximo
                      </span>
                      <span className="text-4xl font-semibold tabular-nums text-text-secondary">
                        {timerState.nextSmallBlind.toLocaleString('pt-BR')} /{' '}
                        {timerState.nextBigBlind?.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  )}

                  {/* PIX do dia: QR (copia e cola estático) + chave */}
                  {tournament?.responsiblePixKey && (
                    <div className="mt-4 flex items-center gap-5 rounded-xl border border-border-default bg-bg-card px-6 py-4">
                      <div className="shrink-0 rounded-lg bg-white p-2">
                        <QRCodeSVG
                          value={buildPixPayload(tournament.responsiblePixKey)}
                          size={140}
                        />
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="text-lg font-semibold uppercase tracking-[0.2em] text-accent-green-deep">
                          PIX
                        </span>
                        <span className="max-w-md break-all text-3xl font-bold text-text-primary">
                          {tournament.responsiblePixKey}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ==== Coluna direita: hora / fichas / intervalo / premiação ==== */}
          <aside className="flex min-h-0 flex-col gap-3">
            {/* Hora atual */}
            <div className="rounded-xl border border-border-default bg-bg-card p-4">
              <div className="mb-1 flex items-center gap-2 text-text-secondary">
                <Clock className="h-5 w-5 text-text-muted" />
                <span className="text-base font-medium uppercase tracking-wider">Hora</span>
              </div>
              <p className="font-mono text-6xl font-bold tabular-nums text-text-primary">
                {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>

            {/* Fichas */}
            <div className="rounded-xl border border-border-default bg-bg-card p-4">
              <div className="mb-1 flex items-center gap-2 text-text-secondary">
                <Coins className="h-5 w-5 text-text-muted" />
                <span className="text-base font-medium uppercase tracking-wider">Fichas em jogo</span>
              </div>
              <p className="text-5xl font-bold tabular-nums text-text-primary">
                {totalChips.toLocaleString('pt-BR')}
              </p>
              <p className="mt-1 text-xl text-text-secondary">
                Média por jogador:{' '}
                <span className="font-semibold tabular-nums text-accent-green-deep">
                  {avgStack.toLocaleString('pt-BR')}
                </span>
              </p>
            </div>

            {/* Próximo intervalo */}
            <div className="rounded-xl border border-border-default bg-bg-card p-4">
              <div className="mb-1 flex items-center gap-2 text-text-secondary">
                <Hourglass className="h-5 w-5 text-text-muted" />
                <span className="text-base font-medium uppercase tracking-wider">Próximo intervalo</span>
              </div>
              <p className="font-mono text-5xl font-bold tabular-nums text-accent-gold-deep">
                {timerState.isBreak
                  ? 'Agora'
                  : secondsToBreak != null
                    ? formatDuration(secondsToBreak)
                    : '—'}
              </p>
            </div>

            {/* Premiação por posição — o mais abaixo possível */}
            <div className="mt-auto flex min-h-0 flex-col rounded-xl border border-border-default bg-bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-text-secondary">
                  <Trophy className="h-5 w-5 text-accent-gold-deep" />
                  <span className="text-base font-medium uppercase tracking-wider">Premiação</span>
                </div>
                <span className="text-xl font-bold tabular-nums text-accent-green-deep">{formatCurrency(premiacao)}</span>
              </div>
              <AutoScrollList className="min-h-0" anchorBottom>
                <div className="flex flex-col gap-1">
                  {prizesList.map((p) => {
                    const winner = eliminatedEntries.find((e) => e.finalPosition === p.position)
                    return (
                      <div
                        key={p.position}
                        className="flex items-center gap-2 rounded-lg bg-bg-tertiary px-2 py-2 text-xl"
                      >
                        <span className="w-12 shrink-0 font-bold tabular-nums text-accent-gold-deep">{p.position}º</span>
                        <span className="shrink-0 font-semibold tabular-nums text-accent-green-deep">
                          {formatCurrency(p.amount)}
                        </span>
                        {winner && (
                          <span className="min-w-0 flex-1 truncate text-right text-text-secondary">
                            {winner.displayName}
                          </span>
                        )}
                      </div>
                    )
                  })}
                  {prizesList.length === 0 && (
                    <p className="py-3 text-center text-base text-text-secondary">Sem premiação calculada</p>
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

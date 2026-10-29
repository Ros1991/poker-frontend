import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarClock, Copy, Loader2, Radio, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import * as mePlayerApi from '../../api/mePlayer.api'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { CompactClock, CompactClockTile } from '../../components/tv/CompactClock'
import { ROUTES } from '../../constants/routes'
import { useBlindTimer } from '../../hooks/useBlindTimer'
import { cn } from '../../utils/cn'
import { copyToClipboard } from '../../utils/clipboard'
import { DUE_TONE_CLASS, addonCountLabel, dueStatus, rebuyCountLabel } from '../../utils/entryStatusLine'
import { errorStatus } from '../../utils/httpErrors'
import { buildPixPayload, normalizePixKey, PIX_KEY_TYPE_LABELS } from '../../utils/pix'
import { secondsToBreak } from '../../utils/timerDisplay'
import type { BadgeColor } from '../../components/ui/Badge'
import type { TimerState } from '../../types/blind.types'
import type { MyTournamentLive } from '../../types/mePlayer.types'
import {
  formatMoney,
  formatTournamentDay,
  isLiveStatus,
  isStillPlaying,
  playerTournamentStatus,
} from './myTournamentFormat'

/** Torneio acontecendo: a ficha e o relógio voltam do servidor a cada 5 s (o relógio anda sozinho entre uma e outra) */
const LIVE_REFRESH_MS = 5_000
/** Agendado: confere de minuto em minuto se começou */
const SCHEDULED_REFRESH_MS = 60_000

/**
 * /meus-torneios/:id (SPEC-20261029-1726): o torneio para quem joga — o relógio compacto do telão no celular
 * (SPEC-20261029-1721) com "Jogando X / Y" e a premiação total (com Prizes no plano do organizador) e a MINHA ficha:
 * mesa e lugar (com Tables), rebuys, add-ons, bounty (torneio com bounty), devido/pago/saldo com o PIX do torneio como
 * atalho (com Payments) e a posição quando sai. Nada dos outros jogadores além das contagens.
 *
 * Atualiza sozinha por consulta a cada 5 s (`GET me/tournaments/{id}`), sem SignalR: o hub do torneio é de quem
 * organiza. O relógio corre no aparelho entre as consultas (`useBlindTimer`) e, ao zerar, pergunta de novo ao servidor
 * (que avança o nível). 404 = a conta não tem inscrição neste torneio.
 */
export function MyTournamentLivePage() {
  const { id = '' } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const queryKey = ['me', 'tournament', id]

  const { formattedTime, timerState, syncFromServer, progressPercentage } = useBlindTimer(() => {
    void queryClient.invalidateQueries({ queryKey })
  })
  // O relógio só aparece depois da primeira sincronização desta tela (como no telão no celular)
  const [synced, setSynced] = useState(false)

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const live = await mePlayerApi.getMyTournament(id)
      if (live.timer) {
        syncFromServer(live.timer as unknown as TimerState)
        setSynced(true)
      }
      return live
    },
    enabled: !!id,
    refetchOnMount: 'always',
    refetchInterval: (q) => {
      const status = q.state.data?.status
      if (!status) return false
      if (isLiveStatus(status)) return LIVE_REFRESH_MS
      return status === 'Draft' ? SCHEDULED_REFRESH_MS : false
    },
    retry: (count, error) => errorStatus(error) !== 404 && count < 2,
  })

  const back = (
    <Link
      to={ROUTES.MY_TOURNAMENTS}
      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg text-sm font-medium text-accent-blue hover:underline"
      data-my-live-back
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Meus torneios
    </Link>
  )

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        {back}
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
        </div>
      </div>
    )
  }

  if (query.isError && !query.data) {
    const notMine = errorStatus(query.error) === 404
    return (
      <div className="mx-auto max-w-5xl space-y-4" data-my-live-error={notMine ? 'sem-inscricao' : 'erro'}>
        {back}
        <div className="rounded-xl border border-border-default bg-bg-secondary p-6 text-center">
          <p className="font-semibold text-text-primary">
            {notMine ? 'Você não tem inscrição neste torneio.' : 'Não foi possível carregar o torneio.'}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {notMine
              ? 'Aqui aparecem só os torneios em que o organizador inscreveu você com o e-mail da sua conta.'
              : 'Confira a conexão e tente de novo.'}
          </p>
          {!notMine && (
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => query.refetch()}>
              Tentar de novo
            </Button>
          )}
        </div>
      </div>
    )
  }

  const t = query.data
  if (!t) return null

  const status = playerTournamentStatus(t.status)
  const live = isLiveStatus(t.status)
  const prizePool = t.prizePool != null ? Math.max(0, t.prizePool) : null
  // Relógio ainda não ligado pelo organizador (sem nível atual): aviso em vez de um 20:00 parado no "Nível 1"
  const clockStarted = !!t.timer && t.timer.currentLevel != null

  return (
    <div className="mx-auto max-w-5xl space-y-5" data-my-live={t.tournamentId}>
      {back}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-text-primary" data-my-live-name>
            {t.name}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {t.homeGameLabel} · {formatTournamentDay(t.date)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
          <Badge color={status.color}>{status.label}</Badge>
          {live && (
            <span className="flex items-center gap-1 text-xs text-text-secondary" data-my-live-auto>
              <Radio className="h-3.5 w-3.5 text-accent-green-deep" aria-hidden />
              Atualiza sozinho
            </span>
          )}
        </div>
      </div>

      {/* Relógio: só com o torneio acontecendo e a estrutura de blinds */}
      {live && clockStarted && synced && (
        <section className="rounded-2xl border border-border-default bg-bg-secondary p-4" aria-label="Relógio do torneio">
          <CompactClock
            // Dentro do layout do painel (menu lateral e margens), o relógio um degrau abaixo do telão no celular para caber
            className="[&_[data-compact-time]]:text-[length:min(24vw,8rem)] [&_[data-compact-time]]:landscape:text-[length:min(24vh,9vw)]"
            timerState={timerState}
            formattedTime={formattedTime}
            progressPercentage={progressPercentage}
            secondsToBreak={secondsToBreak(timerState, t.blindLevels)}
          >
            <CompactClockTile label="Jogando" tileId="playing">
              {t.playersRemaining} / {t.totalEntries}
            </CompactClockTile>
            {prizePool != null && (
              <CompactClockTile label="Premiação" tileId="prize" valueClassName="text-xl text-accent-green-deep">
                {formatMoney(prizePool)}
              </CompactClockTile>
            )}
          </CompactClock>
        </section>
      )}

      {live && !clockStarted && (
        <p
          className="rounded-xl border border-dashed border-border-input bg-bg-secondary px-4 py-6 text-center text-sm text-text-secondary"
          data-my-live-no-clock
        >
          {t.timer ? 'O relógio ainda não começou.' : 'Este torneio não tem relógio de blinds.'} {t.playersRemaining} de{' '}
          {t.totalEntries} jogando.
        </p>
      )}

      {t.status === 'Draft' && (
        <p
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border-input bg-bg-secondary px-4 py-6 text-center text-sm text-text-secondary"
          data-my-live-scheduled
        >
          <CalendarClock className="h-5 w-5 shrink-0" aria-hidden />
          O torneio ainda não começou. Quando o organizador iniciar, o relógio aparece aqui.
        </p>
      )}

      {t.status === 'Finished' && <FinishedBanner t={t} />}

      <MyEntryCard t={t} />
    </div>
  )
}

// ------------------------------------------------------------------ resultado

function FinishedBanner({ t }: { t: MyTournamentLive }) {
  const champion = t.finalPosition === 1
  return (
    <section
      className={cn(
        'flex items-center gap-3 rounded-2xl border p-4',
        champion ? 'border-accent-gold/40 bg-accent-gold-soft' : 'border-border-default bg-bg-secondary',
      )}
      data-my-live-finished
    >
      <Trophy className={cn('h-8 w-8 shrink-0', champion ? 'text-accent-gold-deep' : 'text-text-muted')} aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold text-text-primary">
          {champion
            ? 'Você foi o campeão!'
            : t.finalPosition != null
              ? `Torneio encerrado: você terminou em ${t.finalPosition}º de ${t.totalEntries}.`
              : 'Torneio encerrado.'}
        </p>
        {t.prizeAmount != null && t.prizeAmount > 0 && (
          <p className="text-sm text-text-secondary">Prêmio: {formatMoney(t.prizeAmount)}</p>
        )}
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ minha ficha

function entryBadge(t: MyTournamentLive): { label: string; color: BadgeColor } {
  if (t.finalPosition === 1) return { label: 'Campeão', color: 'gold' }
  if (t.entryStatus === 'Awarded' || t.entryStatus === 'PaidOut') return { label: 'Na premiação', color: 'gold' }
  if (t.entryStatus === 'Eliminated') return { label: 'Eliminado', color: 'red' }
  if (isStillPlaying(t)) return isLiveStatus(t.status) ? { label: 'Jogando', color: 'green' } : { label: 'Inscrito', color: 'blue' }
  return { label: 'Inscrito', color: 'blue' }
}

function Fact({
  label,
  children,
  tone,
  factId,
  compact = false,
}: {
  label: string
  children: ReactNode
  tone?: string
  factId: string
  /** Valor em reais em 3 colunas: um degrau menor no celular, para "R$ 1.160,00" caber */
  compact?: boolean
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border-default bg-bg-card px-3 py-2" data-my-fact={factId}>
      <dt className="truncate text-[11px] font-semibold uppercase tracking-wider text-text-secondary">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 font-bold tabular-nums text-text-primary',
          compact ? 'text-sm min-[400px]:text-base sm:text-lg' : 'text-lg',
          tone,
        )}
      >
        {children}
      </dd>
    </div>
  )
}

function MyEntryCard({ t }: { t: MyTournamentLive }) {
  const badge = entryBadge(t)
  const knockout = t.knockoutType !== 'None'
  const where =
    t.showsTables && t.tableNumber != null && isStillPlaying(t)
      ? `${t.tableName?.trim() || `Mesa ${t.tableNumber}`}${t.seatNumber != null ? ` · lugar ${t.seatNumber}` : ''}`
      : null
  const out = t.finalPosition != null && t.finalPosition > 1 ? `Saiu em ${t.finalPosition}º de ${t.totalEntries}` : null

  return (
    <section className="space-y-4 rounded-2xl border border-border-default bg-bg-secondary p-4" data-my-entry>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-text-primary">Minha ficha</h2>
        <Badge color={badge.color}>{badge.label}</Badge>
      </div>

      {(where || out || t.entryCount > 1) && (
        <p className="text-sm font-medium text-text-primary" data-my-entry-where>
          {where ?? out}
          {t.entryCount > 1 && (
            <span className="text-text-secondary">{where || out ? ' · ' : ''}{t.entryCount} inscrições suas neste torneio</span>
          )}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact label="Rebuys" factId="rebuys">
          {t.rebuyCount}
        </Fact>
        <Fact label="Add-ons" factId="addons">
          {t.addonCount}
        </Fact>
        {knockout && t.bountyHead != null && (
          <Fact label="Na sua cabeça" factId="head" tone="text-accent-purple-deep">
            {formatMoney(t.bountyHead)}
          </Fact>
        )}
        {knockout && t.bountyWon != null && (
          <Fact label="Bounties ganhos" factId="bounty" tone="text-accent-green-deep">
            {formatMoney(t.bountyWon)}
          </Fact>
        )}
        {t.showsPrizes && t.prizeAmount != null && t.prizeAmount > 0 && (
          <Fact label="Prêmio" factId="prize" tone="text-accent-green-deep">
            {formatMoney(t.prizeAmount)}
          </Fact>
        )}
      </dl>

      {t.showsPayments && t.balance != null ? (
        <MoneyBlock t={t} />
      ) : (
        <p className="text-xs text-text-secondary" data-my-entry-summary>
          {rebuyCountLabel(t.rebuyCount)} · {addonCountLabel(t.addonCount)}. Os pagamentos deste torneio são combinados direto
          com o organizador.
        </p>
      )}
    </section>
  )
}

function MoneyBlock({ t }: { t: MyTournamentLive }) {
  const due = dueStatus(t.balance ?? 0)
  return (
    <div className="space-y-3" data-my-entry-money>
      <dl className="grid grid-cols-3 gap-2">
        <Fact label="Total" factId="due" compact>
          {formatMoney(t.totalDue)}
        </Fact>
        <Fact label="Pago" factId="paid" compact>
          {formatMoney(t.totalPaid)}
        </Fact>
        {/* "Deve R$ 90,00" / "Pagou a mais R$ 20,00" / "Saldo: Pago" — a mesma regra do card do dealer (dueStatus) */}
        <Fact
          label={due.tone === 'due' ? 'Deve' : due.tone === 'over' ? 'Pagou a mais' : 'Saldo'}
          factId="balance"
          tone={DUE_TONE_CLASS[due.tone]}
          compact
        >
          <span data-my-entry-due={due.tone}>{due.tone === 'paid' ? 'Pago' : formatMoney(Math.abs(t.balance ?? 0))}</span>
        </Fact>
      </dl>
      {t.pixKey && <PixShortcut pixKey={t.pixKey} balance={t.balance ?? 0} />}
      <p className="text-xs text-text-secondary">
        O pagamento é com o organizador. Quando ele registrar, o valor muda aqui sozinho.
      </p>
    </div>
  )
}

/** Atalho do PIX do torneio: a chave e o "copia e cola" (com o valor que falta, quando deve) */
function PixShortcut({ pixKey, balance }: { pixKey: string; balance: number }) {
  const normalized = normalizePixKey(pixKey)
  const owes = Math.round(balance * 100) / 100 > 0
  const payload = buildPixPayload(pixKey, undefined, undefined, owes ? balance : null)
  const display = normalized.ok && normalized.key ? normalized.display : pixKey
  const rawKey = normalized.ok && normalized.key ? normalized.key : pixKey
  const typeLabel = normalized.ok && normalized.type ? PIX_KEY_TYPE_LABELS[normalized.type] : null

  async function copy(text: string, done: string) {
    if (await copyToClipboard(text)) toast.success(done)
    else toast.error('Não consegui copiar. Copie a chave à mão.')
  }

  return (
    <div className="rounded-xl border border-accent-green/30 bg-accent-green-soft p-3" data-my-entry-pix>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-green-deep">
        PIX do torneio{typeLabel ? ` · ${typeLabel}` : ''}
      </p>
      <p className="mt-0.5 break-all font-mono text-sm font-semibold text-text-primary" data-my-entry-pix-key>
        {display}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => void copy(rawKey, 'Chave PIX copiada')}>
          <Copy className="h-4 w-4" aria-hidden />
          Copiar chave
        </Button>
        {payload && (
          <Button variant="success" size="sm" onClick={() => void copy(payload, 'PIX copia e cola copiado')} data-my-entry-pix-payload>
            <Copy className="h-4 w-4" aria-hidden />
            {owes ? `Copiar PIX de ${formatMoney(balance)}` : 'Copiar PIX copia e cola'}
          </Button>
        )}
      </div>
    </div>
  )
}

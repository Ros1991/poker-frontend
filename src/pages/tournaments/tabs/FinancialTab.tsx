import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeftRight,
  Banknote,
  BarChart3,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  AlertCircle,
  Crosshair,
  RefreshCw,
  Scale,
  Smartphone,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import * as paymentsApi from '../../../api/payments.api'
import * as costExtrasApi from '../../../api/costExtras.api'
import { Avatar } from '../../../components/ui/Avatar'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import type { BadgeColor } from '../../../components/ui/Badge'
import { LoadingSpinner } from '../../../components/common/LoadingSpinner'
import { PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS } from '../../../constants/statuses'
import type { Tournament } from '../../../types/tournament.types'
import { isKnockout, knockoutTypeOf, KNOCKOUT_LABELS } from '../../../utils/knockout'
import type { TournamentEntry, PaymentStatus } from '../../../types/entry.types'
import type {
  PaymentBreakdown,
  PaymentBreakdownMethod,
  PaymentDestinationDetail,
  PaymentLineMethod,
} from '../../../types/payment.types'

interface FinancialTabProps {
  tournament: Tournament
  entries: TournamentEntry[]
}

/** Meio centavo: tolerância das comparações de dinheiro */
const EPS = 0.005

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const METHOD_ICONS: Record<PaymentBreakdownMethod, LucideIcon> = {
  Pix: Smartphone,
  Dinheiro: Banknote,
  Transferencia: ArrowLeftRight,
  Abatimento: Scale,
  Outros: CircleDollarSign,
}

const LINE_METHOD_COLORS: Record<PaymentLineMethod, BadgeColor> = {
  Pix: 'blue',
  Dinheiro: 'green',
  Misto: 'purple',
  Transferencia: 'gray',
  Abatimento: 'gold',
  Outros: 'gray',
}

export function FinancialTab({ tournament, entries }: FinancialTabProps) {
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['paymentSummary', tournament.id],
    queryFn: () => paymentsApi.getSummary(tournament.id),
    // Conferência do dinheiro: sempre a leitura mais nova ao abrir a aba (pagamento ou estorno feito no terminal, em
    // outra aba ou o "Pagar" da aba Custos não chegam por aqui)
    refetchOnMount: 'always',
  })

  const { data: costs, isLoading: loadingCosts } = useQuery({
    queryKey: ['costExtras', tournament.id],
    queryFn: () => costExtrasApi.getAll(tournament.id),
  })

  // Resumo por forma de pagamento e quem pagou para quem (SPEC-20261026-1906). Carregando e erro com aviso no lugar das
  // duas seções (revisão geral 2) — antes elas só não apareciam
  const {
    data: breakdown,
    isLoading: loadingBreakdown,
    isError: breakdownFailed,
    refetch: refetchBreakdown,
    isFetching: fetchingBreakdown,
  } = useQuery({
    queryKey: ['paymentBreakdown', tournament.id],
    queryFn: () => paymentsApi.getBreakdown(tournament.id),
    refetchOnMount: 'always',
  })

  if (loadingSummary || loadingCosts) {
    return <LoadingSpinner text="Carregando financeiro..." />
  }

  const buyInTotal = entries.length * tournament.buyInAmount
  const rebuyTotal = tournament.totalRebuys * tournament.rebuyAmount
  const addonTotal = tournament.totalAddons * tournament.addonAmount
  const totalRevenue = buyInTotal + rebuyTotal + addonTotal
  const totalCosts = costs?.reduce((sum, c) => sum + c.amount, 0) ?? 0
  const totalPaid = summary?.totalPaid ?? 0
  const totalDue = summary?.totalDue ?? 0
  const totalPending = summary?.totalPending ?? 0
  const paymentPct = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0

  const pendingEntries = entries.filter(
    (e) => e.paymentStatus !== 'Paid' && e.balance > 0,
  )

  // Knockout (SPEC-20261026-1909): bounties à parte do prize pool (o líquido do servidor já vem sem eles)
  const knockout = isKnockout(tournament)
  const totalBounties = knockout ? (tournament.totalBounties ?? 0) : 0
  const bountyCount = knockout && (tournament.bountyAmount ?? 0) > 0 ? Math.round(totalBounties / (tournament.bountyAmount ?? 1)) : 0

  return (
    <div className="flex flex-col gap-6">
      {/* Main financial cards */}
      <div className={knockout ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4' : 'grid gap-3 sm:grid-cols-3'}>
        <div className="rounded-xl border border-border-default bg-bg-primary p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-accent-green" />
            <span className="text-xs text-text-secondary">Receitas</span>
          </div>
          <p className="text-2xl font-bold text-accent-green-deep tabular-nums">
            {formatCurrency(totalRevenue)}
          </p>
        </div>
        <div className="rounded-xl border border-border-default bg-bg-primary p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-accent-red" />
            <span className="text-xs text-text-secondary">Custos</span>
          </div>
          <p className="text-2xl font-bold text-accent-red-deep tabular-nums">
            {formatCurrency(totalCosts)}
          </p>
        </div>
        <div className="rounded-xl border border-border-default bg-bg-primary p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-accent-blue" />
            <span className="text-xs text-text-secondary">Premiação Líquida</span>
          </div>
          {/* Valor real, mesmo negativo (custos padrão antes das inscrições, SPEC-20261023-1215): negativo em vermelho */}
          <p
            className={`text-2xl font-bold tabular-nums ${tournament.netPrizePool < 0 ? 'text-accent-red-deep' : 'text-accent-blue'}`}
          >
            {formatCurrency(tournament.netPrizePool)}
          </p>
        </div>
        {knockout && (
          <div className="rounded-xl border border-border-default bg-bg-primary p-4" data-financial-bounties-card>
            <div className="flex items-center gap-2 mb-2">
              <Crosshair className="h-4 w-4 text-accent-purple" />
              <span className="text-xs text-text-secondary">Bounties (à parte do prize pool)</span>
            </div>
            <p className="text-2xl font-bold text-accent-purple-deep tabular-nums" data-financial-bounties-total>
              {formatCurrency(totalBounties)}
            </p>
          </div>
        )}
      </div>

      {/* Revenue breakdown */}
      <div className="rounded-xl border border-border-default bg-bg-primary p-4">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Detalhamento de Receitas
        </h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between py-2 border-b border-border-default">
            <span className="text-sm text-text-primary">
              Buy-ins ({entries.length}x {formatCurrency(tournament.buyInAmount)}
              )
            </span>
            <span className="text-sm font-semibold text-text-primary tabular-nums">
              {formatCurrency(buyInTotal)}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border-default">
            <span className="text-sm text-text-primary">
              Rebuys ({tournament.totalRebuys}x{' '}
              {formatCurrency(tournament.rebuyAmount)})
            </span>
            <span className="text-sm font-semibold text-text-primary tabular-nums">
              {formatCurrency(rebuyTotal)}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border-default">
            <span className="text-sm text-text-primary">
              Add-ons ({tournament.totalAddons}x{' '}
              {formatCurrency(tournament.addonAmount)})
            </span>
            <span className="text-sm font-semibold text-text-primary tabular-nums">
              {formatCurrency(addonTotal)}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 font-semibold">
            <span className="text-sm text-text-primary">Total</span>
            <span className="text-sm text-accent-green-deep tabular-nums">
              {formatCurrency(totalRevenue)}
            </span>
          </div>
          {knockout && (
            <div
              className="flex items-center justify-between gap-3 border-t border-border-default py-2"
              data-financial-bounties-line
            >
              <span className="text-sm text-text-primary">
                Dos quais bounties ({bountyCount}x {formatCurrency(tournament.bountyAmount ?? 0)}) — à parte do prize pool
              </span>
              <span className="shrink-0 text-sm font-semibold text-accent-purple-deep tabular-nums">
                {formatCurrency(totalBounties)}
              </span>
            </div>
          )}
        </div>
      </div>

      {knockout && <BountiesSummary tournament={tournament} entries={entries} total={totalBounties} />}

      {/* Payment status */}
      <div className="rounded-xl border border-border-default bg-bg-primary p-4">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Status de Pagamentos
        </h3>
        <div className="flex justify-between text-xs text-text-secondary tabular-nums mb-2">
          <span>
            {formatCurrency(totalPaid)} de {formatCurrency(totalDue)}
          </span>
          <span>{paymentPct.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-bg-tertiary rounded-full h-4 mb-4">
          <div
            className="bg-accent-green-deep text-white h-4 rounded-full transition-all flex items-center justify-center"
            style={{ width: `${Math.max(paymentPct, 5)}%` }}
          >
            {paymentPct > 15 && (
              <span className="text-[10px] font-bold">
                {paymentPct.toFixed(0)}%
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-text-secondary">Recebido</p>
            <p className="text-sm font-bold text-accent-green-deep tabular-nums" data-financial-received>
              {formatCurrency(totalPaid)}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Pendente</p>
            <p className="text-sm font-bold text-accent-red-deep tabular-nums">
              {formatCurrency(totalPending)}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Total</p>
            <p className="text-sm font-bold text-text-primary tabular-nums">
              {formatCurrency(totalDue)}
            </p>
          </div>
        </div>
      </div>

      {breakdown ? (
        <>
          <MethodSummary breakdown={breakdown} />
          <WhoPaidWhom breakdown={breakdown} />
        </>
      ) : loadingBreakdown ? (
        <div className="rounded-xl border border-border-default bg-bg-primary p-4" data-financial-breakdown-loading>
          <LoadingSpinner size="sm" text="Carregando o detalhamento..." />
        </div>
      ) : breakdownFailed ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-xl border border-accent-red/30 bg-accent-red-soft p-4 sm:flex-row sm:items-center sm:justify-between"
          data-financial-breakdown-error
        >
          <p className="flex items-start gap-2 text-sm text-accent-red-deep">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Não foi possível carregar o detalhamento.
          </p>
          <Button
            variant="secondary"
            className="shrink-0"
            onClick={() => void refetchBreakdown()}
            loading={fetchingBreakdown}
          >
            <RefreshCw className="h-4 w-4" />
            Tentar de novo
          </Button>
        </div>
      ) : null}

      {/* Pending payments list */}
      {pendingEntries.length > 0 && (
        <div className="rounded-xl border border-border-default bg-bg-primary p-4">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-accent-red" />
            Pagamentos Pendentes ({pendingEntries.length})
          </h3>
          <div className="flex flex-col gap-2">
            {pendingEntries
              .sort((a, b) => b.balance - a.balance)
              .map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-2 border-b border-border-default last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-primary">
                      {entry.person.nickname ?? entry.person.fullName}
                    </span>
                    <Badge
                      color={PAYMENT_STATUS_COLORS[entry.paymentStatus as PaymentStatus]}
                    >
                      {PAYMENT_STATUS_LABELS[
                        entry.paymentStatus as PaymentStatus
                      ] ?? entry.paymentStatus}
                    </Badge>
                  </div>
                  <span className="text-sm font-semibold text-accent-red-deep tabular-nums">
                    {formatCurrency(entry.balance)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {pendingEntries.length === 0 && entries.length > 0 && (
        <div className="rounded-xl border border-accent-green/30 bg-accent-green-soft p-4 text-center">
          <CreditCard className="mx-auto h-8 w-8 text-accent-green mb-2" />
          <p className="text-sm font-semibold text-accent-green-deep">
            Todos os pagamentos recebidos!
          </p>
        </div>
      )}

      {entries.length === 0 && (
        <div className="text-center py-8">
          <BarChart3 className="mx-auto h-10 w-10 text-text-muted mb-3" />
          <p className="text-text-secondary">
            Sem dados financeiros ainda.
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Bounties do torneio knockout (SPEC-20261026-1909): quem ganhou quanto eliminando e o que está nas cabeças (de quem
 * ainda joga ou do campeão, que fica com a dele). Ganhos + cabeças = bounties arrecadados — a conferência fecha.
 */
function BountiesSummary({
  tournament,
  entries,
  total,
}: {
  tournament: Tournament
  entries: TournamentEntry[]
  total: number
}) {
  const progressive = knockoutTypeOf(tournament) === 'Progressive'
  const rows = entries
    .map((e) => ({ e, won: e.bountyWon ?? 0, head: e.eliminatedAt ? 0 : (e.bountyHead ?? 0) }))
    .filter((r) => r.won > 0 || r.head > 0)
    .sort((a, b) => b.won + b.head - (a.won + a.head))
  const won = rows.reduce((s, r) => s + r.won, 0)
  const heads = rows.reduce((s, r) => s + r.head, 0)
  const diff = Math.round((total - won - heads) * 100) / 100
  return (
    <div className="rounded-xl border border-border-default bg-bg-primary p-4" data-financial-bounties>
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-1">Bounties</h3>
      <p className="mb-3 text-xs text-text-secondary">
        {KNOCKOUT_LABELS[knockoutTypeOf(tournament)]}:{' '}
        {progressive
          ? 'quem elimina leva metade do bounty em dinheiro e a outra metade soma na própria cabeça.'
          : 'quem elimina leva o bounty inteiro do eliminado.'}{' '}
        Quem não for eliminado (o campeão) fica com o próprio bounty.
      </p>
      {rows.length === 0 ? (
        <p className="py-1 text-sm text-text-secondary">Nenhum bounty ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-text-secondary">
                <th className="py-1.5 text-left font-medium">Jogador</th>
                <th className="py-1.5 text-right font-medium">Ganhou</th>
                <th className="py-1.5 text-right font-medium">Na cabeça</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, won: w, head: h }) => (
                <tr key={e.id} className="border-t border-border-default" data-financial-bounty-row>
                  <td className="py-1.5 text-text-primary">{e.person.nickname ?? e.person.fullName}</td>
                  <td className="py-1.5 text-right tabular-nums text-text-primary">{w > 0 ? formatCurrency(w) : '—'}</td>
                  <td className="py-1.5 text-right tabular-nums text-text-primary">{h > 0 ? formatCurrency(h) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 border-t border-border-default pt-2 text-xs tabular-nums text-text-secondary" data-financial-bounties-check>
        Ganhos {formatCurrency(won)} + nas cabeças {formatCurrency(heads)} = {formatCurrency(won + heads)}
        {Math.abs(diff) > EPS ? (
          <span className="ml-1 font-semibold text-accent-red-deep">— diferença de {formatCurrency(Math.abs(diff))} para os {formatCurrency(total)} arrecadados</span>
        ) : (
          <span className="ml-1 font-semibold text-accent-green-deep">= bounties arrecadados</span>
        )}
      </p>
    </div>
  )
}

/**
 * Resumo do que foi pago por forma de pagamento (PIX, dinheiro e as demais que o sistema registra). O misto entra com
 * a parte PIX no PIX e o resto no dinheiro; o abatimento quita a dívida contra um custo. A soma bate com o Recebido.
 */
function MethodSummary({ breakdown }: { breakdown: PaymentBreakdown }) {
  const sum = breakdown.byMethod.reduce((s, m) => s + m.amount, 0)
  // Conferência na MESMA leitura do servidor (o "pago" das inscrições do próprio detalhamento): comparar com outra
  // consulta em cache (resumo/inscrições lidos em outra hora) acusaria diferença falsa logo depois de um estorno
  const diff = Math.round((breakdown.totalPaidByEntries - sum) * 100) / 100
  return (
    <div className="rounded-xl border border-border-default bg-bg-primary p-4" data-financial-by-method>
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
        Resumo por forma de pagamento
      </h3>
      <div className="flex flex-col">
        {breakdown.byMethod.map((m) => {
          const Icon = METHOD_ICONS[m.method] ?? CircleDollarSign
          return (
            <div
              key={m.method}
              className="flex items-center justify-between gap-3 py-2 border-b border-border-default"
              data-method={m.method}
            >
              <span className="flex min-w-0 items-center gap-2 text-sm text-text-primary">
                <Icon className="h-4 w-4 shrink-0 text-accent-blue" />
                <span className="truncate">{m.label}</span>
                <span className="shrink-0 text-xs text-text-secondary">
                  · {plural(m.count, 'lançamento', 'lançamentos')}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-text-primary tabular-nums" data-method-amount>
                {formatCurrency(m.amount)}
              </span>
            </div>
          )
        })}
        <div className="flex items-center justify-between py-2 font-semibold">
          <span className="text-sm text-text-primary">Total recebido</span>
          <span className="text-sm text-accent-green-deep tabular-nums" data-method-total>
            {formatCurrency(sum)}
          </span>
        </div>
      </div>
      {Math.abs(diff) > EPS ? (
        <p role="alert" className="mt-2 rounded-lg bg-accent-red-soft p-3 text-sm text-accent-red-deep">
          Diferença de {formatCurrency(Math.abs(diff))} entre as formas de pagamento e o Recebido das inscrições —
          confira os estornos.
        </p>
      ) : (
        <p className="mt-1 text-xs text-text-secondary">
          Misto entra com a parte PIX no PIX e o resto no dinheiro. Abatimento quita a dívida contra um custo, sem
          dinheiro trocar de mãos.
        </p>
      )}
    </div>
  )
}

/** Quem pagou para quem: o caixa e cada custo (dealer, caixinha, casa, staff…) com a lista de quem pagou */
function WhoPaidWhom({ breakdown }: { breakdown: PaymentBreakdown }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  // Custos excluídos vêm um por nome ("Custo excluído (Fotógrafo)"): a chave leva a descrição
  const keyOf = (d: PaymentDestinationDetail) => d.costExtraId ?? `${d.kind}:${d.description}`
  const toggle = (k: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  const total = breakdown.destinations.reduce((s, d) => s + d.receivedFromPlayers, 0)

  return (
    <div className="rounded-xl border border-border-default bg-bg-primary p-4" data-financial-destinations>
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-1">
        Quem pagou para quem
      </h3>
      <p className="mb-2 text-xs text-text-secondary">
        Toque num destino para ver quem pagou, quanto, como e a que horas.
      </p>
      <div className="flex flex-col">
        {breakdown.destinations.map((d) => (
          <DestinationRow key={keyOf(d)} detail={d} expanded={open.has(keyOf(d))} onToggle={() => toggle(keyOf(d))} />
        ))}
      </div>
      <div className="flex items-center justify-between pt-2 text-sm font-semibold">
        <span className="text-text-primary">Total dos destinos</span>
        <span className="text-accent-green-deep tabular-nums" data-destinations-total>
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  )
}

function DestinationRow({
  detail: d,
  expanded,
  onToggle,
}: {
  detail: PaymentDestinationDetail
  expanded: boolean
  onToggle: () => void
}) {
  const isCost = d.kind === 'Cost'
  const amount = d.amount ?? 0
  const paid = d.paidAmount ?? 0
  // Recebido a mais: custo que encolheu depois de pago, por jogadores e/ou pelo caixa (o pago fica no valor; o excedente
  // vem do servidor em overReceived) — fora do devido, com o aviso para acertar com o caixa (revisão geral 2)
  const over = isCost ? Math.round(Math.max(d.overReceived ?? 0, paid - amount) * 100) / 100 : 0
  const names = [...new Set(d.lines.map((l) => l.playerName))]
  const Chevron = expanded ? ChevronDown : ChevronRight

  let badge: { color: BadgeColor; text: string } | null = null
  if (isCost) {
    if ((d.remaining ?? 0) > EPS) badge = { color: 'yellow', text: `Falta ${formatCurrency(d.remaining ?? 0)}` }
    else badge = { color: 'green', text: 'Quitado' }
  } else if (d.kind === 'Removed') {
    badge = { color: 'gray', text: 'Excluído' }
  }

  return (
    <div className="border-b border-border-default last:border-0" data-destination-detail={d.costExtraId ?? d.kind}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex min-h-[44px] w-full items-center gap-2 py-2.5 text-left"
      >
        <Chevron className="h-4 w-4 shrink-0 text-text-muted" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">{d.description}</p>
          {d.beneficiary && <p className="truncate text-xs text-text-secondary">{d.beneficiary}</p>}
          <p className="truncate text-xs text-text-secondary" data-destination-payers>
            {names.length > 0 ? `Quem pagou: ${names.join(', ')}` : 'Nenhum jogador pagou direto ainda'}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <p className="text-sm font-semibold text-text-primary tabular-nums" data-destination-received>
            {formatCurrency(d.receivedFromPlayers)}
            {isCost && (
              <span className="text-xs font-normal text-text-secondary"> de {formatCurrency(amount)}</span>
            )}
          </p>
          {badge && <Badge color={badge.color}>{badge.text}</Badge>}
        </div>
      </button>
      {over > EPS && (
        <p
          role="alert"
          className="mb-2 ml-6 rounded-md bg-accent-red-soft px-2 py-1.5 text-xs font-semibold text-accent-red-deep tabular-nums"
          data-destination-over
        >
          {formatCurrency(over)} recebidos a mais — acertar com o caixa
        </p>
      )}

      {expanded && (
        <div className="pb-3 pl-6" data-destination-lines>
          {d.lines.length === 0 ? (
            <p className="py-1 text-xs text-text-secondary">Nenhum jogador pagou direto para este destino.</p>
          ) : (
            <ul className="flex flex-col">
              {d.lines.map((l) => (
                <li
                  key={`${l.transactionId}-${l.method}`}
                  className="flex items-center gap-2 py-1.5"
                  data-destination-line
                >
                  <Avatar src={l.photoUrl} name={l.playerName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text-primary">{l.playerName}</p>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-text-secondary">
                      <span className="tabular-nums">{formatTime(l.createdAt)}</span>
                      <Badge color={LINE_METHOD_COLORS[l.method] ?? 'gray'} className="px-2 py-0">
                        {l.methodLabel}
                      </Badge>
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-text-primary tabular-nums">
                    {formatCurrency(l.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {isCost && (
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-border-default pt-2 text-xs text-text-secondary tabular-nums">
              <span>Dos jogadores: {formatCurrency(d.receivedFromPlayers)}</span>
              {d.settledAmount > EPS && <span>(abatimentos: {formatCurrency(d.settledAmount)})</span>}
              {d.paidByCashBox > EPS && <span>Pago pelo caixa: {formatCurrency(d.paidByCashBox)}</span>}
              <span>Falta: {formatCurrency(d.remaining ?? 0)}</span>
              {over > EPS && <span className="font-semibold text-accent-red-deep">A mais: {formatCurrency(over)}</span>}
            </p>
          )}
          {d.kind === 'CashBox' && (
            <p className="mt-2 border-t border-border-default pt-2 text-xs text-text-secondary">
              PIX na chave do dia, dinheiro e a parte em dinheiro dos pagamentos mistos.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

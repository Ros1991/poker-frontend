import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  AlertCircle,
} from 'lucide-react'
import * as paymentsApi from '../../../api/payments.api'
import * as costExtrasApi from '../../../api/costExtras.api'
import { Badge } from '../../../components/ui/Badge'
import { LoadingSpinner } from '../../../components/common/LoadingSpinner'
import { PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS } from '../../../constants/statuses'
import type { Tournament } from '../../../types/tournament.types'
import type { TournamentEntry, PaymentStatus } from '../../../types/entry.types'

interface FinancialTabProps {
  tournament: Tournament
  entries: TournamentEntry[]
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function FinancialTab({ tournament, entries }: FinancialTabProps) {
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['paymentSummary', tournament.id],
    queryFn: () => paymentsApi.getSummary(tournament.id),
  })

  const { data: costs, isLoading: loadingCosts } = useQuery({
    queryKey: ['costExtras', tournament.id],
    queryFn: () => costExtrasApi.getAll(tournament.id),
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
    (e) => e.paymentStatus !== 'Pago' && e.balance > 0,
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Main financial cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border-default bg-bg-primary p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-accent-green" />
            <span className="text-xs text-text-muted">Receitas</span>
          </div>
          <p className="text-2xl font-bold text-accent-green">
            {formatCurrency(totalRevenue)}
          </p>
        </div>
        <div className="rounded-xl border border-border-default bg-bg-primary p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-accent-red" />
            <span className="text-xs text-text-muted">Custos</span>
          </div>
          <p className="text-2xl font-bold text-accent-red">
            {formatCurrency(totalCosts)}
          </p>
        </div>
        <div className="rounded-xl border border-border-default bg-bg-primary p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-accent-blue" />
            <span className="text-xs text-text-muted">Premiação Líquida</span>
          </div>
          <p className="text-2xl font-bold text-accent-blue">
            {formatCurrency(tournament.netPrizePool)}
          </p>
        </div>
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
            <span className="text-sm font-semibold text-text-primary">
              {formatCurrency(buyInTotal)}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border-default">
            <span className="text-sm text-text-primary">
              Rebuys ({tournament.totalRebuys}x{' '}
              {formatCurrency(tournament.rebuyAmount)})
            </span>
            <span className="text-sm font-semibold text-text-primary">
              {formatCurrency(rebuyTotal)}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border-default">
            <span className="text-sm text-text-primary">
              Add-ons ({tournament.totalAddons}x{' '}
              {formatCurrency(tournament.addonAmount)})
            </span>
            <span className="text-sm font-semibold text-text-primary">
              {formatCurrency(addonTotal)}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 font-semibold">
            <span className="text-sm text-text-primary">Total</span>
            <span className="text-sm text-accent-green">
              {formatCurrency(totalRevenue)}
            </span>
          </div>
        </div>
      </div>

      {/* Payment status */}
      <div className="rounded-xl border border-border-default bg-bg-primary p-4">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Status de Pagamentos
        </h3>
        <div className="flex justify-between text-xs text-text-muted mb-2">
          <span>
            {formatCurrency(totalPaid)} de {formatCurrency(totalDue)}
          </span>
          <span>{paymentPct.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-bg-tertiary rounded-full h-4 mb-4">
          <div
            className="bg-accent-green h-4 rounded-full transition-all flex items-center justify-center"
            style={{ width: `${Math.max(paymentPct, 5)}%` }}
          >
            {paymentPct > 15 && (
              <span className="text-[10px] font-bold text-white">
                {paymentPct.toFixed(0)}%
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-text-muted">Recebido</p>
            <p className="text-sm font-bold text-accent-green">
              {formatCurrency(totalPaid)}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Pendente</p>
            <p className="text-sm font-bold text-accent-red">
              {formatCurrency(totalPending)}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Total</p>
            <p className="text-sm font-bold text-text-primary">
              {formatCurrency(totalDue)}
            </p>
          </div>
        </div>
      </div>

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
                      className={
                        PAYMENT_STATUS_COLORS[
                          entry.paymentStatus as PaymentStatus
                        ] ?? ''
                      }
                    >
                      {PAYMENT_STATUS_LABELS[
                        entry.paymentStatus as PaymentStatus
                      ] ?? entry.paymentStatus}
                    </Badge>
                  </div>
                  <span className="text-sm font-semibold text-accent-red">
                    {formatCurrency(entry.balance)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {pendingEntries.length === 0 && entries.length > 0 && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 text-center">
          <CreditCard className="mx-auto h-8 w-8 text-accent-green mb-2" />
          <p className="text-sm font-semibold text-accent-green">
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

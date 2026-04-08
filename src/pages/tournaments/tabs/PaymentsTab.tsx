import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, AlertCircle, Smartphone, Banknote, Receipt } from 'lucide-react'
import * as paymentsApi from '../../../api/payments.api'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { LoadingSpinner } from '../../../components/common/LoadingSpinner'
import { PaymentModal } from '../../../components/tournament/PaymentModal'
import { PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS } from '../../../constants/statuses'
import type { Tournament } from '../../../types/tournament.types'
import type { TournamentEntry, PaymentStatus } from '../../../types/entry.types'

interface PaymentsTabProps {
  tournament: Tournament
  entries: TournamentEntry[]
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function PaymentsTab({ tournament, entries }: PaymentsTabProps) {
  const [paymentEntry, setPaymentEntry] = useState<TournamentEntry | null>(null)

  const { data: summary, isLoading } = useQuery({
    queryKey: ['paymentSummary', tournament.id],
    queryFn: () => paymentsApi.getSummary(tournament.id),
  })

  const { data: totalsByMethod } = useQuery({
    queryKey: ['paymentTotalsByMethod', tournament.id],
    queryFn: () => paymentsApi.getTotalsByMethod(tournament.id),
  })

  if (isLoading) {
    return <LoadingSpinner text="Carregando pagamentos..." />
  }

  const totalDue = summary?.totalDue ?? 0
  const totalPaid = summary?.totalPaid ?? 0
  const totalPending = totalsByMethod?.totalPending ?? summary?.totalPending ?? 0
  const totalPix = totalsByMethod?.totalPix ?? 0
  const totalCash = totalsByMethod?.totalCash ?? 0
  const totalToCosts = totalsByMethod?.totalToCosts ?? 0
  const progressPct = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-bg-primary p-4">
          <p className="text-xs text-text-muted flex items-center gap-1">
            <Smartphone className="h-3 w-3" />
            Total no PIX
          </p>
          <p className="text-xl font-bold text-accent-blue">
            {formatCurrency(totalPix)}
          </p>
        </div>
        <div className="rounded-lg bg-bg-primary p-4">
          <p className="text-xs text-text-muted flex items-center gap-1">
            <Banknote className="h-3 w-3" />
            Total em Dinheiro
          </p>
          <p className="text-xl font-bold text-accent-green">
            {formatCurrency(totalCash)}
          </p>
        </div>
        <div className="rounded-lg bg-bg-primary p-4">
          <p className="text-xs text-text-muted flex items-center gap-1">
            <Receipt className="h-3 w-3" />
            Pago para Custos
          </p>
          <p className="text-xl font-bold text-accent-yellow">
            {formatCurrency(totalToCosts)}
          </p>
        </div>
        <div className="rounded-lg bg-bg-primary p-4">
          <p className="text-xs text-text-muted flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Total Pendente
          </p>
          <p className="text-xl font-bold text-accent-red">
            {formatCurrency(totalPending)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-text-muted mb-1">
          <span>Progresso de pagamentos</span>
          <span>{progressPct.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-bg-tertiary rounded-full h-3">
          <div
            className="bg-accent-green h-3 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Player payment list */}
      {entries.length > 0 && (
        <div className="flex flex-col gap-2">
          {entries
            .sort((a, b) => b.balance - a.balance)
            .map((entry) => {
              const statusColor =
                PAYMENT_STATUS_COLORS[entry.paymentStatus as PaymentStatus] ?? ''
              const statusLabel =
                PAYMENT_STATUS_LABELS[entry.paymentStatus as PaymentStatus] ??
                entry.paymentStatus

              return (
                <div
                  key={entry.id}
                  className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${
                    entry.paymentStatus === 'Paid'
                      ? 'border-green-500/20 bg-green-500/5'
                      : entry.paymentStatus === 'PartiallyPaid'
                        ? 'border-yellow-500/20 bg-yellow-500/5'
                        : 'border-red-500/20 bg-red-500/5'
                  }`}
                >
                  <div className="flex-1 min-w-[150px]">
                    <p className="text-sm font-medium text-text-primary">
                      {entry.person.nickname ?? entry.person.fullName}
                    </p>
                    <Badge className={statusColor}>{statusLabel}</Badge>
                  </div>

                  <div className="flex items-center gap-6 text-xs text-text-muted">
                    <div className="text-center">
                      <p>Devido</p>
                      <p className="font-semibold text-text-primary">
                        {formatCurrency(entry.totalDue)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p>Pago</p>
                      <p className="font-semibold text-accent-green">
                        {formatCurrency(entry.totalPaid)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p>Pendente</p>
                      <p className="font-semibold text-accent-red">
                        {formatCurrency(entry.balance)}
                      </p>
                    </div>
                  </div>

                  {entry.balance > 0 && (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => setPaymentEntry(entry)}
                    >
                      <CreditCard className="h-4 w-4" />
                      Receber
                    </Button>
                  )}
                </div>
              )
            })}
        </div>
      )}

      {entries.length === 0 && (
        <div className="text-center py-8">
          <CreditCard className="mx-auto h-10 w-10 text-text-muted mb-3" />
          <p className="text-text-secondary">Nenhum pagamento registrado.</p>
        </div>
      )}

      <PaymentModal
        isOpen={!!paymentEntry}
        onClose={() => setPaymentEntry(null)}
        entry={paymentEntry}
        tournamentId={tournament.id}
      />
    </div>
  )
}

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { QRCodeSVG } from 'qrcode.react'
import { CreditCard, AlertCircle, Smartphone, Banknote, Receipt, Pencil, QrCode, Copy } from 'lucide-react'
import * as paymentsApi from '../../../api/payments.api'
import * as tournamentsApi from '../../../api/tournaments.api'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { Modal } from '../../../components/ui/Modal'
import { PixKeyInput } from '../../../components/pix/PixKeyInput'
import { LoadingSpinner } from '../../../components/common/LoadingSpinner'
import { copyToClipboard } from '../../../utils/clipboard'
import {
  buildPixPayload,
  checkPixKey,
  normalizePixKey,
  PIX_KEY_TYPE_LABELS,
  toPixKeyPayload,
  type PixKeyType,
} from '../../../utils/pix'
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
  const queryClient = useQueryClient()
  const [paymentEntry, setPaymentEntry] = useState<TournamentEntry | null>(null)
  const [showPixModal, setShowPixModal] = useState(false)
  const [pixKeyDraft, setPixKeyDraft] = useState('')
  const [pixTypeDraft, setPixTypeDraft] = useState<PixKeyType | null>(null)
  const [showQr, setShowQr] = useState(false)

  // Chave do dia gravada (SPEC-20261023-1218): exibição, tipo, aviso de formato e o mesmo QR do telão
  const savedPix = tournament.responsiblePixKey ?? null
  const pix = normalizePixKey(savedPix)
  const pixDisplay = pix.ok && pix.key ? pix.display : null
  const pixTypeLabel = pix.ok && pix.type ? PIX_KEY_TYPE_LABELS[pix.type] : null
  const pixAmbiguous = pix.ok && pix.alternatives.length > 0
  const pixPayload = buildPixPayload(savedPix)
  const draftCheck = checkPixKey(pixKeyDraft, pixTypeDraft, savedPix)

  const pixKeyMutation = useMutation({
    mutationFn: () => {
      const payload = toPixKeyPayload(pixKeyDraft, pixTypeDraft, savedPix)
      return tournamentsApi.updatePixKey(tournament.id, payload.key, payload.type)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
      toast.success('Chave PIX atualizada!')
      setShowPixModal(false)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao salvar a chave PIX.')
    },
  })

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
      {/* Chave PIX do dia (editável em qualquer fase; aparece no telão com QR) — SPEC-20261023-1218: chave
          formatada e o tipo, aviso de formato não aceito, prévia do mesmo QR do telão e o copia e cola */}
      <div className="rounded-lg border border-border-default bg-bg-primary p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <QrCode className="h-5 w-5 shrink-0 text-accent-blue" />
            <div className="min-w-0">
              <p className="text-xs text-text-secondary">
                Chave PIX do dia{pixTypeLabel ? ` · ${pixTypeLabel}` : ''}
              </p>
              <p className="wrap-anywhere text-sm font-semibold text-text-primary">
                {pixDisplay ?? (savedPix || 'Não definida')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pixPayload && (
              <>
                <Button variant="secondary" onClick={() => setShowQr((v) => !v)} aria-expanded={showQr}>
                  <QrCode className="h-4 w-4" />
                  {showQr ? 'Esconder QR' : 'Ver QR'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    if (await copyToClipboard(pixPayload)) toast.success('Código PIX copiado')
                    else toast.error('Não foi possível copiar o código PIX.')
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Copiar código PIX
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                setPixKeyDraft(savedPix ?? '')
                setPixTypeDraft(null)
                setShowPixModal(true)
              }}
              title="Editar chave PIX"
            >
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          </div>
        </div>

        {savedPix && !pixDisplay && (
          <p role="alert" className="mt-3 rounded-lg bg-accent-red-soft p-3 text-sm text-accent-red-deep">
            Esta chave não está num formato aceito pelos bancos — o QR não aparece no telão. Corrija.
          </p>
        )}
        {pixAmbiguous && (
          <p className="mt-3 rounded-lg bg-accent-gold-soft p-3 text-sm text-text-primary">
            Detectada como CPF — se for celular, edite e escolha Celular.
          </p>
        )}

        {showQr && pixPayload && (
          <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row">
            <div className="shrink-0 rounded-lg bg-white p-2">
              <QRCodeSVG value={pixPayload} size={160} />
            </div>
            <p className="text-sm text-text-secondary">
              Confira com o app do seu banco antes do torneio: deve aparecer o nome do recebedor.
            </p>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-bg-primary p-4">
          <p className="text-xs text-text-secondary flex items-center gap-1">
            <Smartphone className="h-3 w-3" />
            Total no PIX
          </p>
          <p className="text-xl font-bold text-accent-blue tabular-nums">
            {formatCurrency(totalPix)}
          </p>
        </div>
        <div className="rounded-lg bg-bg-primary p-4">
          <p className="text-xs text-text-secondary flex items-center gap-1">
            <Banknote className="h-3 w-3" />
            Total em Dinheiro
          </p>
          <p className="text-xl font-bold text-accent-green-deep tabular-nums">
            {formatCurrency(totalCash)}
          </p>
        </div>
        <div className="rounded-lg bg-bg-primary p-4">
          <p className="text-xs text-text-secondary flex items-center gap-1">
            <Receipt className="h-3 w-3" />
            Pago para Custos
          </p>
          <p className="text-xl font-bold text-accent-gold-deep tabular-nums">
            {formatCurrency(totalToCosts)}
          </p>
        </div>
        <div className="rounded-lg bg-bg-primary p-4">
          <p className="text-xs text-text-secondary flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Total Pendente
          </p>
          <p className="text-xl font-bold text-accent-red-deep tabular-nums">
            {formatCurrency(totalPending)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-text-secondary tabular-nums mb-1">
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
                PAYMENT_STATUS_COLORS[entry.paymentStatus as PaymentStatus]
              const statusLabel =
                PAYMENT_STATUS_LABELS[entry.paymentStatus as PaymentStatus] ??
                entry.paymentStatus

              return (
                <div
                  key={entry.id}
                  className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${
                    entry.paymentStatus === 'Paid'
                      ? 'border-accent-green/30 bg-accent-green-soft'
                      : entry.paymentStatus === 'PartiallyPaid'
                        ? 'border-accent-yellow/40 bg-accent-yellow-soft'
                        : 'border-accent-red/30 bg-accent-red-soft'
                  }`}
                >
                  <div className="flex-1 min-w-[150px]">
                    <p className="text-sm font-medium text-text-primary">
                      {entry.person.nickname ?? entry.person.fullName}
                    </p>
                    <Badge color={statusColor}>{statusLabel}</Badge>
                  </div>

                  <div className="flex items-center gap-6 text-xs text-text-secondary tabular-nums">
                    <div className="text-center">
                      <p>Devido</p>
                      <p className="font-semibold text-text-primary">
                        {formatCurrency(entry.totalDue)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p>Pago</p>
                      <p className="font-semibold text-accent-green-deep">
                        {formatCurrency(entry.totalPaid)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p>Pendente</p>
                      <p className="font-semibold text-accent-red-deep">
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

      {/* Edição da chave PIX (Modal do kit: fecha só no X/Cancelar — SPEC-20261023-1216) */}
      <Modal
        isOpen={showPixModal}
        onClose={() => setShowPixModal(false)}
        title="Chave PIX do dia"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setShowPixModal(false)}
              disabled={pixKeyMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => pixKeyMutation.mutate()}
              loading={pixKeyMutation.isPending}
              disabled={draftCheck.error !== null}
            >
              Salvar
            </Button>
          </div>
        }
        // No celular o ✓ do cabeçalho faz o mesmo que o botão do rodapé e o rodapé some (SPEC-20261027-2132)
        submitAction={{
          label: 'Salvar',
          onClick: () => pixKeyMutation.mutate(),
          loading: pixKeyMutation.isPending,
          disabled: draftCheck.error !== null,
        }}
      >
        <p className="mb-4 text-sm text-text-secondary">
          Aparece no telão com QR Code. Pode digitar o celular só com DDD (ex.: 61 99999-9999) — o sistema
          completa o +55. Deixe vazio para remover.
        </p>
        <PixKeyInput
          id="pix-key-draft"
          label="Chave PIX do dia"
          value={pixKeyDraft}
          onChange={setPixKeyDraft}
          type={pixTypeDraft}
          onTypeChange={setPixTypeDraft}
          savedKey={savedPix}
          disabled={pixKeyMutation.isPending}
        />
      </Modal>
    </div>
  )
}

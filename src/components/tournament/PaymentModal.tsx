import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { QRCodeSVG } from 'qrcode.react'
import { AlertTriangle, Copy, Phone, QrCode, RotateCcw } from 'lucide-react'
import * as paymentsApi from '../../api/payments.api'
import * as tournamentsApi from '../../api/tournaments.api'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import type { TournamentEntry } from '../../types/entry.types'
import type { PixSuggestion } from '../../types/costExtra.types'
import { buildPixPayload, formatPixKey } from '../../utils/pix'
import { copyToClipboard } from '../../utils/clipboard'
import { errorMessage } from '../../utils/httpErrors'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  entry: TournamentEntry | null
  tournamentId: string
}

type PaymentMethod = 'Pix' | 'Dinheiro' | 'Transferencia' | 'Abater'

/** Destino escolhido = o Caixa (gestor financeiro), que não tem custo nem limite */
const CASH_KEY = 'caixa'
const CASH_BOX_LABEL = 'Caixa (gestor financeiro)'
/** Meio centavo: tolerância das comparações de dinheiro */
const EPS = 0.005

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const round2 = (n: number) => Math.round(n * 100) / 100

function toNumber(value: string): number {
  const n = parseFloat(value || '0')
  return Number.isFinite(n) ? n : 0
}

const keyOf = (s: PixSuggestion) => (s.isCashBox || !s.costExtraId ? CASH_KEY : s.costExtraId)

/**
 * Limite por destino (SPEC-20261026-1906): o campo mostra no máximo o que o destino ainda recebe (`cap`; null = sem
 * limite, o caixa). `overflow` é o que passou — a tela avisa e oferece lançar esse resto no caixa ou em outro destino.
 * O texto digitado fica guardado: voltando para o caixa, o valor volta inteiro.
 */
function limitTo(raw: string, cap: number | null): { shown: string; value: number; overflow: number } {
  const wanted = toNumber(raw)
  if (cap === null || wanted <= cap + EPS) return { shown: raw, value: round2(wanted), overflow: 0 }
  return { shown: cap.toFixed(2), value: round2(cap), overflow: round2(wanted - cap) }
}

interface Registered {
  /** "R$ 150,00 para Dealer" — o que foi lançado e para onde */
  lines: string[]
}

export function PaymentModal({
  isOpen,
  onClose,
  entry,
  tournamentId,
}: PaymentModalProps) {
  const queryClient = useQueryClient()
  const [method, setMethod] = useState<PaymentMethod>('Pix')
  const [amount, setAmount] = useState('')
  const [pixAmount, setPixAmount] = useState('')
  const [cashAmount, setCashAmount] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(CASH_KEY)
  const [registered, setRegistered] = useState<Registered | null>(null)
  const [showQr, setShowQr] = useState(false)

  const { data: pixSuggestionsRaw } = useQuery({
    queryKey: ['pixSuggestions', tournamentId],
    queryFn: () => paymentsApi.getPixSuggestions(tournamentId),
    enabled:
      isOpen &&
      (method === 'Pix' || method === 'Transferencia' || method === 'Abater'),
  })

  // Chave do dia (QR do caixa): o mesmo torneio que o painel e o terminal já carregam
  const { data: tournament } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => tournamentsApi.getById(tournamentId),
    enabled: isOpen && !!tournamentId,
  })

  // Pagamentos ja registrados deste jogador
  const { data: existingPayments } = useQuery({
    queryKey: ['payments', tournamentId, entry?.id],
    queryFn: () => paymentsApi.getByEntry(tournamentId, entry!.id),
    enabled: isOpen && !!entry,
  })

  function invalidatePaymentData() {
    queryClient.invalidateQueries({ queryKey: ['entries', tournamentId] })
    queryClient.invalidateQueries({ queryKey: ['paymentTotalsByMethod', tournamentId] })
    queryClient.invalidateQueries({ queryKey: ['paymentSummary', tournamentId] })
    queryClient.invalidateQueries({ queryKey: ['paymentBreakdown', tournamentId] })
    queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
    queryClient.invalidateQueries({ queryKey: ['payments', tournamentId, entry?.id] })
    queryClient.invalidateQueries({ queryKey: ['costExtras', tournamentId] })
    queryClient.invalidateQueries({ queryKey: ['pixSuggestions', tournamentId] })
  }

  const reverseMutation = useMutation({
    mutationFn: (paymentId: string) =>
      paymentsApi.reversePayment(tournamentId, entry!.id, paymentId),
    onSuccess: () => {
      invalidatePaymentData()
      toast.success('Pagamento estornado!')
    },
    onError: (err: unknown) => {
      toast.error(errorMessage(err) || 'Erro ao estornar pagamento.')
    },
  })

  // Caixa (gestor financeiro) SEMPRE primeiro (SPEC-20261026-1906); depois os custos que ainda têm a receber, na
  // ordem que a API devolve. O custo marcado como Caixa (isCashBox) é o próprio caixa: não repete na lista.
  const cashBox: PixSuggestion = {
    costExtraId: null,
    description: CASH_BOX_LABEL,
    pendingAmount: 0,
    pixKey: tournament?.responsiblePixKey ?? null,
    beneficiary: null,
    matchScore: 0,
    suggestedPixAmount: 0,
    isCashBox: true,
  }
  const costDestinations: PixSuggestion[] = (pixSuggestionsRaw ?? []).filter(
    (s) => !!s.costExtraId && !s.isCashBox && s.pendingAmount > EPS,
  )

  // No modo "Abater" só fazem sentido custos reais (não o caixa).
  const destinations: PixSuggestion[] =
    method === 'Abater' ? costDestinations : [cashBox, ...costDestinations]
  const selected = destinations.find((d) => keyOf(d) === selectedKey) ?? null

  // Pre-preencher com o valor pendente quando abre o modal (destino: o caixa). Ajuste de estado durante o render
  // (padrão do React para "resetar quando a prop muda"), sem efeito em cascata.
  const openedFor = isOpen ? entry : null
  const [prevOpenedFor, setPrevOpenedFor] = useState<TournamentEntry | null>(null)
  if (openedFor !== prevOpenedFor) {
    setPrevOpenedFor(openedFor)
    if (openedFor) {
      const due = openedFor.totalDue - openedFor.totalPaid
      setMethod('Pix')
      setSelectedKey(CASH_KEY)
      setAmount(due > 0 ? due.toFixed(2) : '')
      setPixAmount(due > 0 ? due.toFixed(2) : '')
      setCashAmount('')
      setRegistered(null)
      setShowQr(false)
    }
  }

  const paymentMutation = useMutation({
    mutationFn: paymentsApi.create,
    onSuccess: (_data, vars) => {
      invalidatePaymentData()
      toast.success('Pagamento registrado!')
      setRegistered({ lines: [describeLaunch(vars)] })
    },
    onError: (err: unknown) => {
      // O destino pode ter recebido de outro jogador nesse meio tempo: recarrega o "só recebe mais"
      queryClient.invalidateQueries({ queryKey: ['pixSuggestions', tournamentId] })
      toast.error(errorMessage(err) || 'Erro ao registrar pagamento.')
    },
  })

  /**
   * Atalho do limite: lança o que o destino ainda recebe e, em seguida, o restante no caixa (ou no outro destino
   * escolhido) — o total pago pelo jogador fica todo com destino. Se o segundo falhar, o primeiro já valeu: a tela
   * fica com só o restante para tentar de novo.
   */
  const splitMutation = useMutation({
    mutationFn: async (vars: { first: paymentsApi.CreatePaymentInput; second: paymentsApi.CreatePaymentInput }) => {
      await paymentsApi.create(vars.first)
      try {
        await paymentsApi.create(vars.second)
      } catch (err) {
        throw Object.assign(new Error('restante'), { partial: true, cause: err })
      }
    },
    onSuccess: (_data, vars) => {
      invalidatePaymentData()
      toast.success('Pagamento registrado!')
      setRegistered({ lines: [describeLaunch(vars.first), describeLaunch(vars.second)] })
    },
    onError: (err: unknown, vars) => {
      invalidatePaymentData()
      const partial = (err as { partial?: boolean }).partial === true
      if (!partial) {
        toast.error(errorMessage(err) || 'Erro ao registrar pagamento.')
        return
      }
      const cause = (err as { cause?: unknown }).cause
      toast.error(
        `${describeLaunch(vars.first)} registrado, mas o restante não: ${errorMessage(cause) || 'erro ao registrar.'}`,
      )
      // Sobra só o restante, em PIX, no destino escolhido para ele
      setMethod('Pix')
      setSelectedKey(vars.second.pixDestinationCostExtraId ?? CASH_KEY)
      setAmount(vars.second.amount.toFixed(2))
    },
  })

  const settleMutation = useMutation({
    mutationFn: (vars: { costExtraId: string; amount: number }) =>
      paymentsApi.settleAgainstCost(
        tournamentId,
        entry!.id,
        vars.costExtraId,
        vars.amount,
      ),
    onSuccess: (_data, vars) => {
      invalidatePaymentData()
      toast.success('Abatimento registrado!')
      const cost = costDestinations.find((c) => c.costExtraId === vars.costExtraId)
      setRegistered({ lines: [`${formatCurrency(vars.amount)} abatidos de ${cost?.description ?? 'custo'}`] })
    },
    onError: (err: unknown) => {
      queryClient.invalidateQueries({ queryKey: ['pixSuggestions', tournamentId] })
      toast.error(errorMessage(err) || 'Erro ao registrar abatimento.')
    },
  })

  const busy = paymentMutation.isPending || settleMutation.isPending || splitMutation.isPending

  function handleClose() {
    setMethod('Pix')
    setAmount('')
    setPixAmount('')
    setCashAmount('')
    setSelectedKey(CASH_KEY)
    setRegistered(null)
    setShowQr(false)
    onClose()
  }

  if (!entry) return null

  const pending = round2(entry.totalDue - entry.totalPaid)

  // Limite do destino escolhido: PIX/misto → o que o custo ainda recebe (caixa sem limite); abater → o menor entre o
  // que o jogador deve e o que o custo ainda recebe; dinheiro vai sempre para o caixa
  const cap: number | null =
    method === 'Abater'
      ? selected
        ? round2(Math.max(0, Math.min(pending, selected.pendingAmount)))
        : null
      : (method === 'Pix' || method === 'Transferencia') && selected && !selected.isCashBox
        ? round2(selected.pendingAmount)
        : null
  const limited = limitTo(method === 'Transferencia' ? pixAmount : amount, cap)
  const cashValue = round2(toNumber(cashAmount))
  /** Valor que vai para o destino escolhido (PIX puro ou a parte PIX do misto) */
  const destValue = limited.value
  const overflow = limited.overflow

  function destinationName(s: PixSuggestion | null): string {
    return !s || s.isCashBox ? 'o caixa' : s.description
  }

  function describeLaunch(p: paymentsApi.CreatePaymentInput): string {
    const dest = p.pixDestinationCostExtraId
      ? (costDestinations.find((c) => c.costExtraId === p.pixDestinationCostExtraId)?.description ?? 'custo')
      : 'o caixa'
    if (p.method === 'Mixed' && p.pixDestinationCostExtraId)
      return `${formatCurrency(p.pixAmount ?? 0)} em PIX para ${dest} e ${formatCurrency(p.cashAmount ?? 0)} em dinheiro para o caixa`
    return `${formatCurrency(p.amount)} para ${dest}`
  }

  /** Pagamento como está na tela (já limitado ao que o destino recebe) */
  function currentPayment(): paymentsApi.CreatePaymentInput | null {
    if (!entry) return null
    const destId = selected && !selected.isCashBox ? selected.costExtraId : null
    const notes = selected ? `Destino PIX: ${selected.description}` : undefined
    if (method === 'Transferencia') {
      const total = round2(destValue + cashValue)
      if (total <= 0) return null
      return {
        tournamentId,
        entryId: entry.id,
        amount: total,
        method: 'Mixed',
        pixAmount: destValue,
        cashAmount: cashValue,
        pixDestinationCostExtraId: destId,
        notes,
      }
    }
    if (method === 'Pix') {
      if (destValue <= 0) return null
      return { tournamentId, entryId: entry.id, amount: destValue, method: 'Pix', pixDestinationCostExtraId: destId, notes }
    }
    const cash = round2(toNumber(amount))
    if (cash <= 0) return null
    return { tournamentId, entryId: entry.id, amount: cash, method: 'Dinheiro', pixDestinationCostExtraId: null }
  }

  function handleConfirm() {
    if (!entry) return

    if (method === 'Abater') {
      if (!selected?.costExtraId) {
        toast.error('Selecione o custo a abater.')
        return
      }
      if (destValue <= 0) {
        toast.error('Informe um valor válido.')
        return
      }
      settleMutation.mutate({ costExtraId: selected.costExtraId, amount: destValue })
      return
    }

    // Destino escolhido que saiu da lista (outro terminal quitou o custo): nunca troca sozinho para o caixa
    if ((method === 'Pix' || method === 'Transferencia') && !selected) {
      toast.error('Escolha o destino do PIX.')
      return
    }
    const payment = currentPayment()
    if (!payment) {
      toast.error('Informe um valor válido.')
      return
    }
    paymentMutation.mutate(payment)
  }

  /** Atalho: o que o destino recebe + o restante (em PIX) no caixa ou no destino escolhido para ele */
  function handleSplit(target: PixSuggestion) {
    const first = currentPayment()
    if (!first || !entry || overflow <= EPS) return
    splitMutation.mutate({
      first,
      second: {
        tournamentId,
        entryId: entry.id,
        amount: overflow,
        method: 'Pix',
        pixDestinationCostExtraId: target.isCashBox ? null : target.costExtraId,
        notes: `Destino PIX: ${target.description}`,
      },
    })
  }

  // Outros destinos que comportam o restante inteiro (o caixa sempre comporta)
  const remainderTargets = costDestinations.filter(
    (d) => keyOf(d) !== selectedKey && d.pendingAmount >= overflow - EPS,
  )
  const showLimit = (method === 'Pix' || method === 'Transferencia') && overflow > EPS && !!selected

  // QR do PIX com o valor (caixa = chave do dia; custo = a chave do custo); só com chave válida e valor > 0
  const qrPayload =
    (method === 'Pix' || method === 'Transferencia') && selected && destValue > 0
      ? buildPixPayload(selected.pixKey, undefined, undefined, destValue)
      : null

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Registrar Pagamento"
        size="md"
        footer={
          registered ? undefined : (
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={handleClose} disabled={busy}>
                Cancelar
              </Button>
              <Button
                variant="success"
                onClick={handleConfirm}
                loading={paymentMutation.isPending || settleMutation.isPending}
                disabled={busy}
              >
                {method === 'Abater' ? 'Confirmar Abatimento' : 'Confirmar Pagamento'}
              </Button>
            </div>
          )
        }
      >
        {registered ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="rounded-full bg-accent-green-soft p-4">
              <svg
                className="h-8 w-8 text-accent-green-deep"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-text-primary font-semibold">
              Pagamento registrado!
            </p>
            <ul className="flex flex-col items-center gap-1 text-center text-sm text-text-secondary tabular-nums" data-payment-registered>
              {registered.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>

            {entry.person.whatsapp && (
              <a
                href={`https://wa.me/${entry.person.whatsapp.replace(/\D/g, '')}?text=Pagamento+recebido!+Obrigado!`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg bg-accent-green-deep px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-green-hover transition-colors"
              >
                <Phone className="h-4 w-4" />
                Enviar WhatsApp
              </a>
            )}

            <Button variant="ghost" onClick={handleClose}>
              Fechar
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Player info */}
            <div className="rounded-lg bg-bg-primary p-3">
              <p className="font-semibold text-text-primary">
                {entry.person.nickname ?? entry.person.fullName}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-text-secondary tabular-nums">
                <span>Total: {formatCurrency(entry.totalDue)}</span>
                <span>Pago: {formatCurrency(entry.totalPaid)}</span>
                <span className="font-semibold text-accent-red-deep">
                  Pendente: {formatCurrency(pending)}
                </span>
              </div>
            </div>

            {/* Method selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">
                Método
              </label>
              <div className="flex flex-wrap gap-2">
                {(['Pix', 'Dinheiro', 'Transferencia', 'Abater'] as PaymentMethod[]).map(
                  (m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMethod(m)
                        setSelectedKey(m === 'Abater' ? null : CASH_KEY)
                        setShowQr(false)
                      }}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-[40px] ${
                        method === m
                          ? 'bg-accent-blue text-white'
                          : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {m === 'Transferencia' ? 'Misto' : m}
                    </button>
                  ),
                )}
              </div>
              {method === 'Abater' && (
                <p className="text-xs text-text-secondary">
                  Quita a dívida do jogador contra um custo do qual é favorecido
                  (ex.: dono/staff que também jogou). Reduz o saldo do jogador e o
                  "a receber" do custo, sem dinheiro trocar de mãos.
                </p>
              )}
            </div>

            {/* Amount fields based on method — o campo do destino mostra no máximo o que ele ainda recebe */}
            {method === 'Transferencia' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Valor PIX (R$)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={limited.shown}
                  onChange={(e) => setPixAmount(e.target.value)}
                  placeholder="0.00"
                  data-payment-amount
                />
                <Input
                  label="Valor Dinheiro (R$)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            ) : (
              <Input
                label="Valor (R$)"
                type="number"
                step="0.01"
                min="0"
                value={limited.shown}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={pending.toFixed(2)}
                data-payment-amount
              />
            )}

            {/* PIX destination suggestions / custo a abater — caixa primeiro */}
            {(method === 'Pix' || method === 'Transferencia' || method === 'Abater') &&
              destinations.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-text-secondary">
                    {method === 'Abater' ? 'Abater de qual custo' : 'Destino PIX'}
                  </label>
                  <div className="max-h-[30dvh] overflow-y-auto overscroll-contain flex flex-col gap-1" data-payment-destinations>
                    {destinations.map((suggestion) => (
                      <button
                        key={keyOf(suggestion)}
                        type="button"
                        data-destination={keyOf(suggestion)}
                        aria-pressed={selectedKey === keyOf(suggestion)}
                        onClick={() => {
                          setSelectedKey(keyOf(suggestion))
                          setShowQr(false)
                        }}
                        className={`flex items-center justify-between rounded-lg p-2.5 text-left text-sm transition-colors ${
                          selectedKey === keyOf(suggestion)
                            ? 'bg-accent-blue-soft border border-accent-blue/50'
                            : 'bg-bg-primary hover:bg-bg-tertiary border border-transparent'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-text-primary truncate">
                            {suggestion.description}
                          </p>
                          {suggestion.beneficiary && (
                            <p className="text-xs text-text-secondary truncate">
                              {suggestion.beneficiary}
                            </p>
                          )}
                          {suggestion.pixKey && (
                            <p className="text-xs text-accent-blue truncate">
                              {formatPixKey(suggestion.pixKey)}
                            </p>
                          )}
                        </div>
                        {!suggestion.isCashBox && suggestion.pendingAmount > 0 && (
                          <span className="ml-2 shrink-0 text-right text-xs text-text-secondary">
                            recebe até
                            <span className="block text-sm font-semibold text-text-primary tabular-nums">
                              {formatCurrency(suggestion.pendingAmount)}
                            </span>
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            {/* Limite do destino (Pix/Misto): avisa e oferece lançar o restante no caixa ou em outro destino */}
            {showLimit && selected && cap !== null && (
              <div role="alert" className="flex flex-col gap-2 rounded-lg border border-accent-gold bg-accent-gold-soft p-3" data-payment-limit>
                <p className="flex items-start gap-2 text-sm font-semibold text-text-primary">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-gold-deep" />
                  <span>
                    {selected.description} só recebe mais {formatCurrency(cap)}.
                  </span>
                </p>
                <p className="text-sm text-text-secondary">
                  O valor foi limitado. Faltam {formatCurrency(overflow)} para completar este pagamento:
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => handleSplit(cashBox)}
                  loading={splitMutation.isPending}
                  disabled={busy}
                  data-remainder-target={CASH_KEY}
                >
                  Lançar {formatCurrency(cap)} para {selected.description} e {formatCurrency(overflow)} para o caixa
                </Button>
                {remainderTargets.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs text-text-secondary">ou o restante em outro destino:</p>
                    {remainderTargets.map((d) => (
                      <Button
                        key={keyOf(d)}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start border border-border-default"
                        onClick={() => handleSplit(d)}
                        disabled={busy}
                        data-remainder-target={keyOf(d)}
                      >
                        {formatCurrency(overflow)} para {d.description}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Abatimento acima do que o custo comporta (ou do que o jogador deve): o campo limita e explica */}
            {method === 'Abater' && selected && overflow > EPS && (
              <p role="alert" className="rounded-lg border border-accent-gold bg-accent-gold-soft p-3 text-sm text-text-primary" data-payment-limit>
                {selected.pendingAmount < pending - EPS
                  ? `${selected.description} só recebe mais ${formatCurrency(selected.pendingAmount)}. O restante continua pendente para pagar por PIX ou dinheiro.`
                  : `Só há ${formatCurrency(Math.max(0, pending))} em aberto para abater.`}
              </p>
            )}

            {/* QR do PIX já com o valor, para o jogador ler no app do banco */}
            {qrPayload && selected && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 text-xs text-text-secondary">
                  PIX de {formatCurrency(destValue)} para {destinationName(selected)}
                </p>
                <Button variant="secondary" size="sm" onClick={() => setShowQr(true)} data-payment-qr-button>
                  <QrCode className="h-4 w-4" />
                  QR com valor
                </Button>
              </div>
            )}

            {/* Pagamentos ja registrados */}
            <div className="border-t border-border-default pt-3">
              <p className="text-xs font-semibold text-text-secondary uppercase mb-2">
                Pagamentos registrados
                {existingPayments && existingPayments.length > 0 && (
                  <span className="ml-1 text-text-secondary normal-case">
                    ({existingPayments.length})
                  </span>
                )}
              </p>
              {!existingPayments || existingPayments.length === 0 ? (
                <p className="text-xs text-text-secondary text-center py-2">
                  Nenhum pagamento registrado ainda.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-[30dvh] overflow-y-auto overscroll-contain">
                  {existingPayments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg bg-bg-primary p-2 text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-text-primary tabular-nums">
                          {formatCurrency(p.amount)}
                          {p.paymentMethod && (
                            <span className="ml-2 text-xs text-text-secondary">
                              via {p.paymentMethod}
                            </span>
                          )}
                        </p>
                        {p.description && (
                          <p className="text-xs text-text-secondary truncate">
                            {p.description}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => reverseMutation.mutate(p.id)}
                        disabled={reverseMutation.isPending}
                        className="p-1.5 rounded text-text-secondary hover:text-accent-red hover:bg-accent-red-soft transition-colors"
                        title="Estornar pagamento"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {method === 'Abater' && destinations.length === 0 && (
              <p className="text-xs text-accent-gold-deep">
                Nenhum custo disponível para abatimento (precisa de um custo com
                saldo a receber, como staff ou ranking).
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* QR com valor: modal por cima, fecha só no X (fora da árvore do outro modal) */}
      <Modal
        isOpen={showQr && !!qrPayload && !registered}
        onClose={() => setShowQr(false)}
        title="PIX com valor"
        size="sm"
      >
        {qrPayload && selected && (
          <div className="flex flex-col items-center gap-3 text-center" data-payment-qr>
            <p className="text-3xl font-bold text-text-primary tabular-nums">{formatCurrency(destValue)}</p>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{selected.description}</p>
              {selected.beneficiary && <p className="text-xs text-text-secondary">{selected.beneficiary}</p>}
              <p className="wrap-anywhere text-xs text-accent-blue">{formatPixKey(selected.pixKey)}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <QRCodeSVG value={qrPayload} size={220} />
            </div>
            <p className="text-sm text-text-secondary">
              Mostre o QR para ler no app do banco: o valor já vem preenchido.
            </p>
            <Button
              variant="secondary"
              className="w-full"
              onClick={async () => {
                if (await copyToClipboard(qrPayload)) toast.success('Código PIX copiado')
                else toast.error('Não foi possível copiar o código PIX.')
              }}
            >
              <Copy className="h-4 w-4" />
              Copiar código PIX
            </Button>
          </div>
        )}
      </Modal>
    </>
  )
}

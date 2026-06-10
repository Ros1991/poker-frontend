import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Phone, RotateCcw } from 'lucide-react'
import * as paymentsApi from '../../api/payments.api'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import type { TournamentEntry } from '../../types/entry.types'
import type { PixSuggestion } from '../../types/costExtra.types'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  entry: TournamentEntry | null
  tournamentId: string
}

type PaymentMethod = 'Pix' | 'Dinheiro' | 'Transferencia' | 'Abater'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
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
  const [selectedPix, setSelectedPix] = useState<PixSuggestion | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  const { data: pixSuggestionsRaw } = useQuery({
    queryKey: ['pixSuggestions', tournamentId],
    queryFn: () => paymentsApi.getPixSuggestions(tournamentId),
    enabled:
      isOpen &&
      (method === 'Pix' || method === 'Transferencia' || method === 'Abater'),
  })

  // Pagamentos ja registrados deste jogador
  const { data: existingPayments } = useQuery({
    queryKey: ['payments', tournamentId, entry?.id],
    queryFn: () => paymentsApi.getByEntry(tournamentId, entry!.id),
    enabled: isOpen && !!entry,
  })

  const reverseMutation = useMutation({
    mutationFn: (paymentId: string) =>
      paymentsApi.reversePayment(tournamentId, entry!.id, paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['paymentTotalsByMethod', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['payments', tournamentId, entry?.id] })
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['costExtras', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['pixSuggestions', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['paymentTotalsByMethod', tournamentId] })
      toast.success('Pagamento estornado!')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao estornar pagamento.')
    },
  })

  // Adicionar opcao "Caixa" ao final como destino sempre disponivel
  const pixSuggestions: PixSuggestion[] = [
    ...(pixSuggestionsRaw ?? []),
    {
      costExtraId: null,
      description: 'Caixa (gestor financeiro)',
      pendingAmount: 0,
      pixKey: null,
      beneficiary: 'Caixa',
      matchScore: 0,
      suggestedPixAmount: 0,
      isCashBox: true,
    },
  ]

  // No modo "Abater" só fazem sentido custos reais (não o caixa).
  const destinations: PixSuggestion[] =
    method === 'Abater'
      ? (pixSuggestionsRaw ?? []).filter((s) => s.costExtraId)
      : pixSuggestions

  // Pre-preencher amount com o valor pendente quando abre o modal
  useEffect(() => {
    if (isOpen && entry) {
      const pending = entry.totalDue - entry.totalPaid
      setAmount(pending > 0 ? pending.toFixed(2) : '')
      setPixAmount(pending > 0 ? pending.toFixed(2) : '')
      setCashAmount('')
    }
  }, [isOpen, entry])

  // Quando as sugestoes carregarem, selecionar Caixa por padrao
  useEffect(() => {
    if (
      isOpen &&
      pixSuggestionsRaw !== undefined &&
      !selectedPix &&
      (method === 'Pix' || method === 'Transferencia')
    ) {
      const cashBox: PixSuggestion = {
        costExtraId: null,
        description: 'Caixa (gestor financeiro)',
        pendingAmount: 0,
        pixKey: null,
        beneficiary: 'Caixa',
        matchScore: 0,
        suggestedPixAmount: 0,
        isCashBox: true,
      }
      setSelectedPix(cashBox)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pixSuggestionsRaw, method])

  const paymentMutation = useMutation({
    mutationFn: paymentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['paymentTotalsByMethod', tournamentId] })
      queryClient.invalidateQueries({
        queryKey: ['paymentSummary', tournamentId],
      })
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['payments', tournamentId, entry?.id] })
      queryClient.invalidateQueries({ queryKey: ['costExtras', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['pixSuggestions', tournamentId] })
      toast.success('Pagamento registrado!')
      setShowSuccess(true)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao registrar pagamento.')
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['paymentTotalsByMethod', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['paymentSummary', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['payments', tournamentId, entry?.id] })
      queryClient.invalidateQueries({ queryKey: ['costExtras', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['pixSuggestions', tournamentId] })
      toast.success('Abatimento registrado!')
      setShowSuccess(true)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao registrar abatimento.')
    },
  })

  function handleClose() {
    setMethod('Pix')
    setAmount('')
    setPixAmount('')
    setCashAmount('')
    setSelectedPix(null)
    setShowSuccess(false)
    onClose()
  }

  function handleConfirm() {
    if (!entry) return

    if (method === 'Abater') {
      const settleAmount = parseFloat(amount || '0')
      if (settleAmount <= 0) {
        toast.error('Informe um valor valido.')
        return
      }
      if (!selectedPix?.costExtraId) {
        toast.error('Selecione o custo a abater.')
        return
      }
      settleMutation.mutate({
        costExtraId: selectedPix.costExtraId,
        amount: settleAmount,
      })
      return
    }

    const totalAmount =
      method === 'Transferencia'
        ? parseFloat(pixAmount || '0') + parseFloat(cashAmount || '0')
        : parseFloat(amount || '0')

    if (totalAmount <= 0) {
      toast.error('Informe um valor valido.')
      return
    }

    if (method === 'Transferencia') {
      paymentMutation.mutate({
        tournamentId,
        entryId: entry.id,
        amount: totalAmount,
        method: 'Mixed',
        pixAmount: parseFloat(pixAmount || '0'),
        cashAmount: parseFloat(cashAmount || '0'),
        pixDestinationCostExtraId: selectedPix?.costExtraId ?? null,
        notes: selectedPix ? `Destino PIX: ${selectedPix.description}` : undefined,
      })
    } else {
      paymentMutation.mutate({
        tournamentId,
        entryId: entry.id,
        amount: totalAmount,
        method,
        pixDestinationCostExtraId:
          method === 'Pix' ? selectedPix?.costExtraId ?? null : null,
        notes:
          method === 'Pix' && selectedPix
            ? `Destino PIX: ${selectedPix.description}`
            : undefined,
      })
    }
  }

  if (!entry) return null

  const pending = entry.totalDue - entry.totalPaid

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Registrar Pagamento" size="md">
      {showSuccess ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="rounded-full bg-accent-green/20 p-4">
            <svg
              className="h-8 w-8 text-accent-green"
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

          {entry.person.whatsapp && (
            <a
              href={`https://wa.me/${entry.person.whatsapp.replace(/\D/g, '')}?text=Pagamento+recebido!+Obrigado!`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors"
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
            <div className="flex gap-4 mt-1 text-sm text-text-muted">
              <span>Total: {formatCurrency(entry.totalDue)}</span>
              <span>Pago: {formatCurrency(entry.totalPaid)}</span>
              <span className="font-semibold text-accent-red">
                Pendente: {formatCurrency(pending)}
              </span>
            </div>
          </div>

          {/* Method selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Metodo
            </label>
            <div className="flex flex-wrap gap-2">
              {(['Pix', 'Dinheiro', 'Transferencia', 'Abater'] as PaymentMethod[]).map(
                (m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMethod(m)
                      setSelectedPix(null)
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
              <p className="text-xs text-text-muted">
                Quita a dívida do jogador contra um custo de que ele é favorecido
                (ex.: dono/staff que também jogou). Reduz o saldo do jogador e o
                "a receber" do custo, sem dinheiro trocar de mãos.
              </p>
            )}
          </div>

          {/* Amount fields based on method */}
          {method === 'Transferencia' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Valor PIX (R$)"
                type="number"
                step="0.01"
                value={pixAmount}
                onChange={(e) => setPixAmount(e.target.value)}
                placeholder="0.00"
              />
              <Input
                label="Valor Dinheiro (R$)"
                type="number"
                step="0.01"
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
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={pending.toFixed(2)}
            />
          )}

          {/* PIX destination suggestions / custo a abater */}
          {(method === 'Pix' || method === 'Transferencia' || method === 'Abater') &&
            destinations.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-secondary">
                  {method === 'Abater' ? 'Abater de qual custo' : 'Destino PIX'}
                </label>
                <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                  {destinations.map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedPix(suggestion)
                        if (method === 'Abater' && suggestion.pendingAmount > 0) {
                          setAmount(
                            Math.min(pending, suggestion.pendingAmount).toFixed(2),
                          )
                        }
                      }}
                      className={`flex items-center justify-between rounded-lg p-2.5 text-left text-sm transition-colors ${
                        (selectedPix?.costExtraId ?? null) === (suggestion.costExtraId ?? null)
                          ? 'bg-accent-blue/10 border border-accent-blue/50'
                          : 'bg-bg-primary hover:bg-bg-tertiary border border-transparent'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text-primary truncate">
                          {suggestion.description}
                        </p>
                        {suggestion.beneficiary && (
                          <p className="text-xs text-text-muted truncate">
                            {suggestion.beneficiary}
                          </p>
                        )}
                        {suggestion.pixKey && (
                          <p className="text-xs text-accent-blue truncate">
                            {suggestion.pixKey}
                          </p>
                        )}
                      </div>
                      {!suggestion.isCashBox && suggestion.pendingAmount > 0 && (
                        <span className="text-sm font-semibold text-text-primary ml-2 shrink-0">
                          {formatCurrency(suggestion.pendingAmount)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

          {/* Pagamentos ja registrados */}
          <div className="border-t border-border-default pt-3">
            <p className="text-xs font-semibold text-text-secondary uppercase mb-2">
              Pagamentos registrados
              {existingPayments && existingPayments.length > 0 && (
                <span className="ml-1 text-text-muted normal-case">
                  ({existingPayments.length})
                </span>
              )}
            </p>
            {!existingPayments || existingPayments.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-2">
                Nenhum pagamento registrado ainda.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                {existingPayments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg bg-bg-primary p-2 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text-primary">
                        {formatCurrency(p.amount)}
                        {p.paymentMethod && (
                          <span className="ml-2 text-xs text-text-muted">
                            via {p.paymentMethod}
                          </span>
                        )}
                      </p>
                      {p.description && (
                        <p className="text-xs text-text-muted truncate">
                          {p.description}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => reverseMutation.mutate(p.id)}
                      disabled={reverseMutation.isPending}
                      className="p-1.5 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
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
            <p className="text-xs text-yellow-400">
              Nenhum custo disponível para abatimento (precisa de um custo com
              saldo a receber, como staff ou ranking).
            </p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={paymentMutation.isPending || settleMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="success"
              onClick={handleConfirm}
              loading={paymentMutation.isPending || settleMutation.isPending}
            >
              {method === 'Abater' ? 'Confirmar Abatimento' : 'Confirmar Pagamento'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

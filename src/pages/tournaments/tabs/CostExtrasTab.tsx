import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, DollarSign, Check, Banknote, Building2, X } from 'lucide-react'
import * as costExtrasApi from '../../../api/costExtras.api'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import { Badge } from '../../../components/ui/Badge'
import { LoadingSpinner } from '../../../components/common/LoadingSpinner'
import type { Tournament } from '../../../types/tournament.types'

interface CostExtrasTabProps {
  tournament: Tournament
}

const costExtraSchema = z.object({
  description: z.string().min(1, 'Descricao obrigatoria'),
  amount: z.coerce.number().min(0.01, 'Valor invalido'),
  paidByPersonId: z.string().optional(),
})

type CostExtraFormData = z.infer<typeof costExtraSchema>

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function CostExtrasTab({ tournament }: CostExtrasTabProps) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CostExtraFormData>({
    resolver: zodResolver(costExtraSchema),
    defaultValues: {
      description: '',
      amount: 0,
      paidByPersonId: '',
    },
  })

  const { data: costs, isLoading } = useQuery({
    queryKey: ['costExtras', tournament.id],
    queryFn: () => costExtrasApi.getAll(tournament.id),
  })

  const createMutation = useMutation({
    mutationFn: (data: CostExtraFormData) =>
      costExtrasApi.create(tournament.id, {
        description: data.description,
        amount: data.amount,
        paidByPersonId: data.paidByPersonId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costExtras', tournament.id] })
      queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
      toast.success('Custo adicionado!')
      setShowForm(false)
      reset()
    },
    onError: () => {
      toast.error('Erro ao adicionar custo.')
    },
  })

  const payMutation = useMutation({
    mutationFn: (vars: { id: string; method: 'Pix' | 'Dinheiro' | 'Caixa' }) =>
      costExtrasApi.pay(tournament.id, vars.id, { method: vars.method }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costExtras', tournament.id] })
      queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
      toast.success('Custo marcado como pago!')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao marcar como pago.')
    },
  })

  const unpayMutation = useMutation({
    mutationFn: (id: string) => costExtrasApi.unpay(tournament.id, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costExtras', tournament.id] })
      queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
      toast.success('Pagamento revertido.')
    },
    onError: () => toast.error('Erro ao reverter pagamento.'),
  })

  const totalCosts =
    costs?.reduce((sum, c) => sum + c.amount, 0) ?? 0

  if (isLoading) {
    return <LoadingSpinner text="Carregando custos..." />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Custos Extras
          </h2>
          <p className="text-sm text-text-muted">
            Total: {formatCurrency(totalCosts)}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          Adicionar Custo
        </Button>
      </div>

      {(!costs || costs.length === 0) && (
        <div className="text-center py-12">
          <DollarSign className="mx-auto h-10 w-10 text-text-muted mb-3" />
          <p className="text-text-secondary">Nenhum custo extra registrado.</p>
        </div>
      )}

      {costs && costs.length > 0 && (
        <div className="flex flex-col gap-2">
          {costs.map((cost) => {
            const isPaid = cost.paymentStatus === 'Paid'
            const isPartial = cost.paymentStatus === 'PartiallyPaid'
            const paidAmount = cost.paidAmount ?? 0
            const pending = cost.amount - paidAmount
            return (
              <div
                key={cost.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border-default bg-bg-primary p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {cost.description}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
                    {cost.beneficiary && <span>Para: {cost.beneficiary}</span>}
                    {isPaid && cost.paymentMethod && (
                      <span className="text-accent-green">
                        Pago via {cost.paymentMethod}
                      </span>
                    )}
                    {isPartial && (
                      <span className="text-yellow-400">
                        Pago: {formatCurrency(paidAmount)} / Falta:{' '}
                        {formatCurrency(pending)}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-semibold text-text-primary shrink-0">
                  {formatCurrency(cost.amount)}
                </span>
                {isPaid ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge color="green">
                      <Check className="h-3 w-3 mr-1" />
                      Pago
                    </Badge>
                    <button
                      type="button"
                      onClick={() => unpayMutation.mutate(cost.id)}
                      className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Reverter pagamento"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    {isPartial && <Badge color="yellow">Parcial</Badge>}
                    <button
                      type="button"
                      onClick={() => payMutation.mutate({ id: cost.id, method: 'Dinheiro' })}
                      disabled={payMutation.isPending}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-text-secondary hover:bg-accent-green/10 hover:text-accent-green transition-colors"
                      title="Pago em Dinheiro"
                    >
                      <Banknote className="h-3.5 w-3.5" />
                      Dinheiro
                    </button>
                    <button
                      type="button"
                      onClick={() => payMutation.mutate({ id: cost.id, method: 'Caixa' })}
                      disabled={payMutation.isPending}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-text-secondary hover:bg-accent-blue/10 hover:text-accent-blue transition-colors"
                      title="Pago pelo Caixa (gestor financeiro)"
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      Caixa
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add cost modal */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false)
          reset()
        }}
        title="Adicionar Custo Extra"
        size="sm"
      >
        <form
          onSubmit={handleSubmit((data) => createMutation.mutate(data))}
          className="flex flex-col gap-4"
        >
          <Input
            label="Descricao *"
            {...register('description')}
            error={errors.description?.message}
            placeholder="Ex: Comida, Bebidas, Local..."
          />
          <Input
            label="Valor (R$) *"
            type="number"
            step="0.01"
            {...register('amount')}
            error={errors.amount?.message}
          />
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowForm(false)
                reset()
              }}
              disabled={createMutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Adicionar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

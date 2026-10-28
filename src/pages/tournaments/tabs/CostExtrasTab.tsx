import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, DollarSign, Check, Banknote, Building2, X, Pencil, Trash2 } from 'lucide-react'
import * as costExtrasApi from '../../../api/costExtras.api'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import { Badge } from '../../../components/ui/Badge'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { LoadingSpinner } from '../../../components/common/LoadingSpinner'
import { PixKeyInput } from '../../../components/pix/PixKeyInput'
import { checkPixKey, formatPixKey, toPixKeyPayload, type PixKeyType } from '../../../utils/pix'
import type { Tournament } from '../../../types/tournament.types'
import { COST_TYPE_DEFAULT, type CostExtra } from '../../../types/costExtra.types'

interface CostExtrasTabProps {
  tournament: Tournament
}

const costExtraSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Descrição obrigatória')
    .max(500, 'Até 500 caracteres'),
  amount: z.coerce.number().min(0.01, 'Valor inválido'),
  beneficiary: z.string().trim().max(200, 'Até 200 caracteres'),
  pixKey: z.string().trim().max(200, 'Até 200 caracteres'),
})

type CostExtraFormData = z.infer<typeof costExtraSchema>

/** Campo opcional vazio vai como null (o PUT grava o pedido inteiro). */
const orNull = (v: string) => (v.trim() === '' ? null : v.trim())

const EMPTY_FORM: CostExtraFormData = {
  description: '',
  amount: 0,
  beneficiary: '',
  pixKey: '',
}

/** Mensagem do 400 da API (ex.: chave PIX fora de formato) ou a genérica. */
const apiMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function CostExtrasTab({ tournament }: CostExtrasTabProps) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingCost, setEditingCost] = useState<CostExtra | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<CostExtra | null>(null)
  // Tipo escolhido no campo da chave PIX (null = automático) — SPEC-20261023-1218
  const [pixType, setPixType] = useState<PixKeyType | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<CostExtraFormData>({
    resolver: zodResolver(costExtraSchema) as Resolver<CostExtraFormData>,
    defaultValues: EMPTY_FORM,
  })

  const { data: costs, isLoading } = useQuery({
    queryKey: ['costExtras', tournament.id],
    queryFn: () => costExtrasApi.getAll(tournament.id),
  })

  const pixKeyValue = useWatch({ control, name: 'pixKey' }) ?? ''

  const createMutation = useMutation({
    mutationFn: (data: CostExtraFormData) => {
      const pix = toPixKeyPayload(data.pixKey, pixType)
      return costExtrasApi.create(tournament.id, {
        description: data.description,
        amount: data.amount,
        beneficiary: orNull(data.beneficiary),
        pixKey: pix.key,
        pixKeyType: pix.type,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costExtras', tournament.id] })
      queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
      toast.success('Custo adicionado!')
      setShowForm(false)
      reset(EMPTY_FORM)
    },
    onError: (err: unknown) => {
      toast.error(apiMessage(err, 'Erro ao adicionar custo.'))
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
    onError: (err: unknown) => toast.error(apiMessage(err, 'Erro ao reverter pagamento.')),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => costExtrasApi.remove(tournament.id, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costExtras', tournament.id] })
      queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
      toast.success('Custo excluído.')
      setDeleteConfirm(null)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao excluir custo.')
    },
  })

  // Edição manda TODOS os campos do custo (o PUT copia o pedido inteiro): sem isso a primeira edição
  // apagaria beneficiário e chave PIX (ex.: churrasqueiro vindo da estrutura, Staff com a chave do home game).
  // A chave vai normalizada com o tipo do campo (escolhido, ou o da chave gravada enquanto o texto não mudar);
  // o Caixa não aparece na tela e vai como estava.
  const editMutation = useMutation({
    mutationFn: (vars: { cost: CostExtra; data: CostExtraFormData }) => {
      const pix = toPixKeyPayload(vars.data.pixKey, pixType, vars.cost.pixKey ?? null)
      return costExtrasApi.update(tournament.id, vars.cost.id, {
        description: vars.data.description,
        amount: vars.data.amount,
        beneficiary: orNull(vars.data.beneficiary),
        pixKey: pix.key,
        pixKeyType: pix.type,
        isCashBox: vars.cost.isCashBox ?? false,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costExtras', tournament.id] })
      queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
      toast.success('Custo atualizado!')
      setShowForm(false)
      setEditingCost(null)
      reset(EMPTY_FORM)
    },
    onError: (err: unknown) => toast.error(apiMessage(err, 'Erro ao atualizar custo.')),
  })

  function openEdit(cost: CostExtra) {
    setEditingCost(cost)
    setPixType(null)
    reset({
      description: cost.description,
      amount: cost.amount,
      beneficiary: cost.beneficiary ?? '',
      pixKey: cost.pixKey ?? '',
    })
    setShowForm(true)
  }

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
          <p className="text-sm text-text-secondary tabular-nums">
            Total: {formatCurrency(totalCosts)}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditingCost(null)
            setPixType(null)
            reset(EMPTY_FORM)
            setShowForm(true)
          }}
        >
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
            const isStaff = cost.costType === 'Staff'
            const isRanking = cost.costType === 'RankingAccumulated'
            const isDefault = cost.costType === COST_TYPE_DEFAULT
            // "Reverter pagamento" desfaz só o que o caixa pagou (revisão geral 2): custo quitado por jogadores não tem o
            // X — o pagamento do jogador se desfaz pelo estorno, no histórico
            const paidByCashBox = cost.paidByCashBox ?? Math.max(0, paidAmount - (cost.paidByPlayers ?? 0))
            const canUnpay = paidByCashBox > 0.005
            return (
              <div
                key={cost.id}
                className="flex flex-col gap-2 rounded-lg border border-border-default bg-bg-primary p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                data-cost-row={cost.description}
              >
                {/* No celular: linha de cima com descrição e valor (a descrição quebra
                    linha em vez de sumir). Do sm em diante o wrapper some (contents)
                    e tudo volta a ficar numa linha só. */}
                <div className="flex items-start justify-between gap-3 sm:contents">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary flex flex-wrap items-center gap-x-2 gap-y-1 wrap-anywhere sm:flex-nowrap sm:truncate">
                      {cost.description}
                      {isStaff && <Badge color="blue">Staff (auto)</Badge>}
                      {isRanking && <Badge color="purple">Ranking (auto)</Badge>}
                      {isDefault && (
                        <span title="Veio da estrutura de blinds" className="inline-flex">
                          <Badge color="gray">Padrão</Badge>
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-text-secondary sm:flex-nowrap">
                      {cost.beneficiary && <span>Para: {cost.beneficiary}</span>}
                      {cost.pixKey && !cost.isCashBox && (
                        <span className="wrap-anywhere">PIX: {formatPixKey(cost.pixKey)}</span>
                      )}
                      {isPaid && cost.paymentMethod && (
                        <span className="text-accent-green-deep">
                          Pago via {cost.paymentMethod}
                        </span>
                      )}
                      {isPartial && (
                        <span className="text-accent-gold-deep tabular-nums">
                          Pago: {formatCurrency(paidAmount)} / Falta:{' '}
                          {formatCurrency(pending)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-text-primary tabular-nums shrink-0">
                    {formatCurrency(cost.amount)}
                  </span>
                </div>
                {/* No celular: linha de baixo com situação/pagar à esquerda e editar/excluir à direita */}
                <div className="flex items-center justify-between gap-2 sm:contents">
                  {isPaid ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge color="green">
                        <Check className="h-3 w-3 mr-1" />
                        Pago
                      </Badge>
                      {canUnpay && (
                        <button
                          type="button"
                          onClick={() => unpayMutation.mutate(cost.id)}
                          className="p-2 sm:p-1 rounded text-text-secondary hover:text-accent-red hover:bg-accent-red-soft transition-colors"
                          title="Reverter pagamento"
                          aria-label={`Reverter o pagamento do caixa de ${cost.description}`}
                          data-cost-unpay
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      {isPartial && <Badge color="yellow">Parcial</Badge>}
                      <button
                        type="button"
                        onClick={() => payMutation.mutate({ id: cost.id, method: 'Dinheiro' })}
                        disabled={payMutation.isPending}
                        className="flex items-center gap-1 rounded-md px-2 py-2 sm:py-1 text-xs font-medium text-text-secondary hover:bg-accent-green-soft hover:text-accent-green-deep transition-colors"
                        title="Pago em Dinheiro"
                      >
                        <Banknote className="h-3.5 w-3.5" />
                        Dinheiro
                      </button>
                      <button
                        type="button"
                        onClick={() => payMutation.mutate({ id: cost.id, method: 'Caixa' })}
                        disabled={payMutation.isPending}
                        className="flex items-center gap-1 rounded-md px-2 py-2 sm:py-1 text-xs font-medium text-text-secondary hover:bg-accent-blue-soft hover:text-accent-blue transition-colors"
                        title="Pago pelo Caixa (gestor financeiro)"
                      >
                        <Building2 className="h-3.5 w-3.5" />
                        Caixa
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-0.5 shrink-0">
                    {!isPaid && (
                      <button
                        type="button"
                        onClick={() => openEdit(cost)}
                        className="p-2 sm:p-1 rounded text-text-secondary hover:text-accent-blue hover:bg-accent-blue-soft transition-colors"
                        title="Editar custo"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {/* Staff automático não pode ser excluído; o acumulado do ranking pode
                        (o valor volta pro prêmio — pra quando não se quer acumular). */}
                    {!isStaff && (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(cost)}
                        className="p-2 sm:p-1 rounded text-accent-red hover:text-accent-red-deep hover:bg-accent-red-soft transition-colors"
                        title={isRanking ? 'Excluir (valor volta pro prêmio)' : 'Excluir custo'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
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
          setEditingCost(null)
          reset(EMPTY_FORM)
        }}
        title={editingCost ? 'Editar Custo Extra' : 'Adicionar Custo Extra'}
        size="sm"
        // No celular o ✓ do cabeçalho faz o mesmo que o botão do rodapé e o rodapé some (SPEC-20261027-2132)
        submitAction={{
          label: editingCost ? 'Salvar' : 'Adicionar',
          form: 'cost-extra-form',
          loading: createMutation.isPending || editMutation.isPending,
        }}
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowForm(false)
                setEditingCost(null)
                reset(EMPTY_FORM)
              }}
              disabled={createMutation.isPending || editMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="cost-extra-form"
              loading={createMutation.isPending || editMutation.isPending}
            >
              {editingCost ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        }
      >
        <form
          id="cost-extra-form"
          onSubmit={handleSubmit((data) => {
            // Chave PIX no formato dos bancos (SPEC-20261023-1218): inválida ou ambígua não deixa salvar
            const pixError = checkPixKey(data.pixKey, pixType, editingCost?.pixKey ?? null).error
            if (pixError) {
              setError('pixKey', { message: pixError })
              return
            }
            if (editingCost) editMutation.mutate({ cost: editingCost, data })
            else createMutation.mutate(data)
          })}
          className="flex flex-col gap-4"
        >
          <Input
            label="Descrição *"
            {...register('description')}
            error={errors.description?.message}
            placeholder="Ex.: Comida, bebidas, local..."
          />
          <Input
            label="Valor (R$) *"
            type="number"
            step="0.01"
            inputMode="decimal"
            {...register('amount')}
            error={errors.amount?.message}
          />
          <Input
            label="Para quem (opcional)"
            {...register('beneficiary')}
            error={errors.beneficiary?.message}
            placeholder="Ex.: Zé do churrasco"
          />
          <PixKeyInput
            id="cost-extra-pix-key"
            label="Chave PIX (opcional)"
            value={pixKeyValue}
            onChange={(v) => {
              setValue('pixKey', v, { shouldDirty: true })
              clearErrors('pixKey')
            }}
            type={pixType}
            onTypeChange={(t) => {
              setPixType(t)
              clearErrors('pixKey')
            }}
            savedKey={editingCost?.pixKey ?? null}
            error={errors.pixKey?.message}
          />
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) removeMutation.mutate(deleteConfirm.id)
        }}
        title="Excluir Custo"
        message={
          deleteConfirm?.costType === 'RankingAccumulated'
            ? `Excluir o custo "${deleteConfirm.description}"? O valor de ${formatCurrency(deleteConfirm.amount)} volta para o prêmio e este torneio não acumula nada para o ranking.`
            : `Excluir o custo "${deleteConfirm?.description ?? ''}"?`
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={removeMutation.isPending}
      />
    </div>
  )
}

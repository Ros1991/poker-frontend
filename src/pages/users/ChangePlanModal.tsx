import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import * as usersApi from '../../api/users.api'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { PLAN_SOURCE_LABELS, formatPlanPrice } from '../../components/plan'
import { usePlanCatalog } from '../../hooks/usePlanCatalog'
import { MY_PLAN_QUERY_KEY } from '../../hooks/usePlan'
import type { PlanName, PlanSource } from '../../types/plan.types'
import type { AdminUserDetail } from '../../types/user.types'
import { errorMessage } from '../../utils/httpErrors'
import { cn } from '../../utils/cn'
import {
  ADMIN_USERS_QUERY_KEY,
  adminUserQueryKey,
  endOfDayIso,
  toDateInput,
  todayInput,
} from './adminUserFormat'

const SOURCES: PlanSource[] = ['Manual', 'Cortesia', 'Trial', 'Assinatura']

const schema = z
  .object({
    plan: z.enum(['Mesa', 'Clube', 'Liga']),
    source: z.enum(['Manual', 'Cortesia', 'Trial', 'Assinatura']),
    noExpiry: z.boolean(),
    expiresAt: z.string(),
    note: z.string().max(200, 'A observação deve ter no máximo 200 caracteres.'),
  })
  .superRefine((data, ctx) => {
    if (data.plan === 'Mesa' || data.noExpiry) return
    if (!data.expiresAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message: 'Informe o vencimento ou marque "Sem vencimento".',
      })
    } else if (data.expiresAt < todayInput()) {
      ctx.addIssue({ code: 'custom', path: ['expiresAt'], message: 'O vencimento precisa ser hoje ou depois.' })
    }
  })

type FormData = z.infer<typeof schema>

interface ChangePlanModalProps {
  isOpen: boolean
  onClose: () => void
  user: AdminUserDetail
}

/**
 * "Alterar plano" da ficha (SPEC-20261023-1206): plano (cartões com o preço do catálogo — a única fonte de preços),
 * origem, vencimento opcional ("sem vencimento" para cortesia) e observação (ex.: "fundador"). Grava pelo
 * PUT admin/users/{id}/plan, que registra o histórico. Fecha só no X/Cancelar.
 */
export function ChangePlanModal({ isOpen, onClose, user }: ChangePlanModalProps) {
  if (!isOpen) return null
  return <ChangePlanForm onClose={onClose} user={user} />
}

function ChangePlanForm({ onClose, user }: Omit<ChangePlanModalProps, 'isOpen'>) {
  const queryClient = useQueryClient()
  const { plans, isLoading: plansLoading } = usePlanCatalog()

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      plan: user.plan.plan,
      source: user.plan.source,
      noExpiry: !user.plan.expiresAt,
      expiresAt: toDateInput(user.plan.expiresAt),
      note: user.plan.note ?? '',
    },
  })

  const plan = useWatch({ control, name: 'plan' })
  const noExpiry = useWatch({ control, name: 'noExpiry' })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      usersApi.changePlan(user.id, {
        plan: data.plan,
        source: data.source,
        expiresAt: data.plan === 'Mesa' || data.noExpiry ? null : endOfDayIso(data.expiresAt),
        note: data.note.trim() || null,
      }),
    onSuccess: async (detail) => {
      queryClient.setQueryData(adminUserQueryKey(user.id), detail)
      await queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: MY_PLAN_QUERY_KEY })
      toast.success(`Plano de ${user.fullName} alterado para ${detail.plan.effectivePlan}.`)
      onClose()
    },
    onError: (err) => {
      toast.error(errorMessage(err) ?? 'Não foi possível alterar o plano.')
    },
  })

  // No celular o ✓ do cabeçalho faz o mesmo que o botão do rodapé e o rodapé some (SPEC-20261027-2132)
  const submitAction = { label: 'Salvar plano', form: 'form-alterar-plano', loading: mutation.isPending }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Alterar plano"
      size="lg"
      submitAction={submitAction}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-alterar-plano"
            loading={mutation.isPending}
          >
            Salvar plano
          </Button>
        </div>
      }
    >
      <form
        id="form-alterar-plano"
        onSubmit={(e) => void handleSubmit((data) => mutation.mutate(data))(e)}
        className="flex flex-col gap-5"
      >
        <p className="text-sm text-text-secondary">
          Conta de <span className="font-semibold text-text-primary">{user.fullName}</span> ({user.email}).
          A troca vale na hora e fica no histórico.
        </p>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-text-secondary">Plano</legend>
          {plansLoading ? (
            <LoadingSpinner size="sm" text="Carregando planos..." />
          ) : (
            <div role="radiogroup" aria-label="Plano" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {plans.map((def) => {
                const selected = plan === def.name
                return (
                  <button
                    key={def.name}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setValue('plan', def.name as PlanName, { shouldValidate: true })}
                    className={cn(
                      'flex min-h-[72px] flex-col items-start justify-center rounded-xl border-2 px-4 py-3 text-left transition-colors',
                      selected
                        ? 'border-accent-blue bg-accent-blue-soft'
                        : 'border-border-input bg-bg-card hover:bg-bg-tertiary',
                    )}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="text-base font-bold text-text-primary">{def.name}</span>
                      {selected && <Check className="h-5 w-5 text-accent-blue" aria-hidden="true" />}
                    </span>
                    <span className="text-sm text-text-secondary">
                      {def.priceMonthly > 0 ? `${formatPlanPrice(def.priceMonthly)}/mês` : formatPlanPrice(def.priceMonthly)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </fieldset>

        <Select
          id="plano-origem"
          label="Origem"
          options={SOURCES.map((s) => ({ value: s, label: PLAN_SOURCE_LABELS[s] }))}
          error={errors.source?.message}
          {...register('source')}
        />

        {plan !== 'Mesa' && (
          <div className="flex flex-col gap-3">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm text-text-primary">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-border-input bg-bg-input text-accent-blue focus:ring-accent-blue"
                {...register('noExpiry')}
              />
              Sem vencimento
            </label>
            {!noExpiry && (
              <Input
                id="plano-vencimento"
                label="Vence em"
                type="date"
                min={todayInput()}
                error={errors.expiresAt?.message}
                helperText="O plano vale até o fim deste dia; depois a conta volta para o Mesa."
                {...register('expiresAt')}
              />
            )}
          </div>
        )}

        <Input
          id="plano-observacao"
          label="Observação"
          placeholder="Ex.: fundador, amigo do grupo, pagou por PIX"
          maxLength={200}
          error={errors.note?.message}
          {...register('note')}
        />
      </form>
    </Modal>
  )
}

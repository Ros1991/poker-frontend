import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import * as usersApi from '../../api/users.api'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import { FormPageBar } from '../../components/ui/FormTopBar'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { ROUTES, userDetailPath } from '../../constants/routes'
import { useAuth } from '../../hooks/useAuth'
import type { UserRole } from '../../types/user.types'
import { formatPhone, isValidWhatsapp, whatsappInput } from '../../utils/phone'
import { errorMessage, errorStatus } from '../../utils/httpErrors'
import {
  ADMIN_USERS_QUERY_KEY,
  ROLE_OPTIONS,
  adminUserQueryKey,
  isGuid,
  roleLabel,
} from './adminUserFormat'

const schema = z.object({
  fullName: z.string().trim().min(1, 'Nome é obrigatório').max(200, 'O nome deve ter no máximo 200 caracteres'),
  nickname: z.string().trim().max(100, 'O apelido deve ter no máximo 100 caracteres'),
  email: z.email('E-mail inválido'),
  whatsapp: z
    .string()
    .refine((v) => !v.trim() || isValidWhatsapp(v), 'Informe o WhatsApp com DDD (10 ou 11 dígitos)'),
  role: z.enum(['Admin', 'TournamentDirector', 'Dealer', 'Player']),
})

type FormData = z.infer<typeof schema>

/**
 * "Editar dados" da Administração (SPEC-20261023-1206): nome, apelido, e-mail, WhatsApp e papel. Só edição — a
 * administração não cria contas (D14) — e sem campos de senha (ficam no modal "Redefinir senha" da ficha). O Admin não
 * muda o próprio papel; trocar o papel de alguém encerra as sessões dessa pessoa.
 */
export function UserFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { user: me } = useAuth()
  const validId = isGuid(id)

  const { data: user, isLoading, isError, error } = useQuery({
    queryKey: adminUserQueryKey(id ?? ''),
    queryFn: () => usersApi.getById(id!),
    enabled: validId,
    retry: (count, err) => errorStatus(err) !== 404 && count < 2,
  })
  const isSelf = !!user && me?.id === user.id

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: user
      ? {
          fullName: user.fullName,
          nickname: user.nickname ?? '',
          email: user.email,
          whatsapp: user.whatsapp ? formatPhone(user.whatsapp) : '',
          role: user.role,
        }
      : undefined,
  })

  const goBack = () =>
    navigate(validId ? userDetailPath(id) : ROUTES.USERS, { state: location.state })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      usersApi.update(id!, {
        fullName: data.fullName.trim(),
        nickname: data.nickname.trim(),
        email: data.email.trim(),
        whatsapp: whatsappInput(data.whatsapp),
        // A própria conta não muda de papel (o backend também recusa)
        role: isSelf ? undefined : (data.role as UserRole),
      }),
    onSuccess: async (detail) => {
      queryClient.setQueryData(adminUserQueryKey(detail.id), detail)
      await queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY })
      toast.success('Dados da conta atualizados!')
      goBack()
    },
    onError: (err) => {
      toast.error(errorMessage(err) ?? 'Não foi possível salvar os dados da conta.')
    },
  })

  const whatsapp = useWatch({ control, name: 'whatsapp' })

  if (validId && isLoading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" text="Carregando a conta..." />
      </div>
    )
  }

  if (!validId || isError || !user) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-6 py-20 text-center">
        <AlertCircle className="h-12 w-12 text-accent-red" aria-hidden="true" />
        <p className="text-text-secondary">
          {!validId || errorStatus(error) === 404 ? 'Conta não encontrada.' : 'Não foi possível carregar a conta.'}
        </p>
        <Button variant="secondary" onClick={() => navigate(ROUTES.USERS)}>
          Voltar para a Administração
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Celular (< sm, SPEC-20261027-2132): barra fixa no topo com X (= Cancelar), título e ✓ (= Salvar alterações); o
          cabeçalho e o rodapé da página somem e os campos ganham o espaço. Do sm para cima, como antes */}
      <FormPageBar
        title="Editar dados"
        subtitle={user.fullName}
        onCancel={goBack}
        submit={{ label: 'Salvar alterações', form: 'user-form', loading: mutation.isPending, disabled: !isDirty }}
      />
      <div className="hidden items-center gap-3 sm:flex">
        <button
          type="button"
          onClick={goBack}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
          aria-label="Voltar para a ficha"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-text-primary">Editar dados</h1>
          <p className="truncate text-sm text-text-secondary">{user.fullName}</p>
        </div>
      </div>

      <form
        id="user-form"
        onSubmit={(e) => void handleSubmit((data) => mutation.mutate(data))(e)}
        className="flex max-w-2xl flex-col gap-6 rounded-xl border border-border-default bg-bg-card p-4 shadow-sm sm:p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="usuario-nome"
            label="Nome completo *"
            placeholder="Nome da pessoa"
            error={errors.fullName?.message}
            {...register('fullName')}
          />
          <Input
            id="usuario-apelido"
            label="Apelido"
            placeholder="Apelido (opcional)"
            error={errors.nickname?.message}
            {...register('nickname')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="usuario-email"
            label="E-mail *"
            type="email"
            placeholder="pessoa@email.com"
            error={errors.email?.message}
            helperText="Ao trocar, o e-mail novo vale para entrar e para receber os avisos."
            {...register('email')}
          />
          <Input
            id="usuario-whatsapp"
            label="WhatsApp"
            inputMode="tel"
            placeholder="(11) 99999-9999"
            error={errors.whatsapp?.message}
            {...register('whatsapp')}
            value={whatsapp ?? ''}
            onChange={(e) =>
              setValue('whatsapp', formatPhone(whatsappInput(e.target.value)), {
                shouldDirty: true,
                shouldValidate: !!errors.whatsapp,
              })
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          {isSelf ? (
            <>
              <span className="text-sm font-medium text-text-secondary">Papel</span>
              <p className="flex min-h-[44px] items-center rounded-lg border border-border-input bg-bg-tertiary px-3 text-sm text-text-primary">
                {roleLabel(user.role)}
              </p>
            </>
          ) : (
            <Select
              id="usuario-papel"
              label="Papel *"
              options={ROLE_OPTIONS}
              error={errors.role?.message}
              {...register('role')}
            />
          )}
          <p className="text-xs text-text-secondary">
            {isSelf
              ? 'Esta é a sua conta: você não pode mudar o seu próprio papel.'
              : 'Trocar o papel encerra as sessões da pessoa (ela entra de novo com o papel novo).'}
          </p>
        </div>

        {/* No celular, o X e o ✓ da barra do topo */}
        <div className="hidden gap-3 sm:flex sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={goBack}>
            Cancelar
          </Button>
          <Button type="submit" loading={mutation.isPending} disabled={!isDirty}>
            Salvar alterações
          </Button>
        </div>
      </form>
    </div>
  )
}

import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import * as usersApi from '../../api/users.api'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { ROUTES } from '../../constants/routes'

const roleOptions = [
  { value: 'Admin', label: 'Administrador' },
  { value: 'TournamentDirector', label: 'Organizador' },
  { value: 'Dealer', label: 'Dealer' },
  { value: 'Player', label: 'Jogador' },
]

const createUserSchema = z
  .object({
    fullName: z.string().min(1, 'Nome e obrigatorio'),
    nickname: z.string().optional(),
    email: z.email('E-mail invalido'),
    whatsapp: z.string().optional(),
    password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
    confirmPassword: z.string().min(1, 'Confirme a senha'),
    role: z.enum(['Admin', 'TournamentDirector', 'Dealer', 'Player']),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas nao coincidem',
    path: ['confirmPassword'],
  })

const editUserSchema = z
  .object({
    fullName: z.string().min(1, 'Nome e obrigatorio'),
    nickname: z.string().optional(),
    email: z.email('E-mail invalido'),
    whatsapp: z.string().optional(),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
    role: z.enum(['Admin', 'TournamentDirector', 'Dealer', 'Player']),
  })
  .refine(
    (data) => {
      if (data.password && data.password.length > 0) {
        return data.password === data.confirmPassword
      }
      return true
    },
    {
      message: 'As senhas nao coincidem',
      path: ['confirmPassword'],
    },
  )

type CreateUserFormData = z.infer<typeof createUserSchema>
type EditUserFormData = z.infer<typeof editUserSchema>
type UserFormData = CreateUserFormData | EditUserFormData

export function UserFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ['user', id],
    queryFn: () => usersApi.getById(id!),
    enabled: isEditing,
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(
      isEditing ? editUserSchema : createUserSchema,
    ) as Resolver<UserFormData>,
    values: user
      ? {
          fullName: user.name,
          nickname: '',
          email: user.email,
          whatsapp: '',
          password: '',
          confirmPassword: '',
          role: user.role,
        }
      : undefined,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateUserFormData) =>
      usersApi.create({
        fullName: data.fullName,
        nickname: data.nickname || undefined,
        email: data.email,
        whatsapp: data.whatsapp || undefined,
        password: data.password,
        role: data.role,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Usuario criado com sucesso!')
      navigate(ROUTES.USERS)
    },
    onError: () => {
      toast.error('Erro ao criar usuario.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: UserFormData) =>
      usersApi.update(id!, {
        fullName: data.fullName,
        nickname: data.nickname || undefined,
        email: data.email,
        password: data.password || undefined,
        role: data.role,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      await queryClient.invalidateQueries({ queryKey: ['user', id] })
      toast.success('Usuario atualizado com sucesso!')
      navigate(ROUTES.USERS)
    },
    onError: () => {
      toast.error('Erro ao atualizar usuario.')
    },
  })

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  function onSubmit(data: UserFormData) {
    if (isEditing) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data as CreateUserFormData)
    }
  }

  if (isEditing && isLoadingUser) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" text="Carregando usuario..." />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {isEditing ? 'Editar Usuario' : 'Novo Usuario'}
          </h1>
          <p className="text-sm text-text-secondary">
            {isEditing
              ? 'Atualize os dados do usuario'
              : 'Crie um novo usuario do sistema'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="flex flex-col gap-6 rounded-xl border border-border-default bg-bg-secondary p-6 max-w-2xl"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Nome Completo *"
            placeholder="Nome do usuario"
            error={errors.fullName?.message}
            {...register('fullName')}
          />
          <Input
            label="Apelido"
            placeholder="Apelido (opcional)"
            error={errors.nickname?.message}
            {...register('nickname')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="E-mail *"
            type="email"
            placeholder="usuario@email.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="WhatsApp"
            placeholder="+5511999999999"
            error={errors.whatsapp?.message}
            {...register('whatsapp')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={isEditing ? 'Nova Senha' : 'Senha *'}
            type="password"
            placeholder={
              isEditing ? 'Deixe vazio para manter' : 'Minimo 6 caracteres'
            }
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label={isEditing ? 'Confirmar Nova Senha' : 'Confirmar Senha *'}
            type="password"
            placeholder="Repita a senha"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
        </div>

        <Select
          label="Perfil *"
          options={roleOptions}
          placeholder="Selecione o perfil"
          error={errors.role?.message}
          {...register('role')}
        />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEditing ? 'Salvar Alteracoes' : 'Criar Usuario'}
          </Button>
        </div>
      </form>
    </div>
  )
}

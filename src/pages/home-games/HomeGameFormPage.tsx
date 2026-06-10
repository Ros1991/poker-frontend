import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import * as homeGamesApi from '../../api/homeGames.api'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { Button } from '../../components/ui/Button'
import { ROUTES, homeGameDetailPath } from '../../constants/routes'
import { useHomeGame } from '../../contexts/HomeGameContext'

const homeGameSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome e obrigatorio')
    .max(100, 'Maximo 100 caracteres'),
  description: z
    .string()
    .max(500, 'Maximo 500 caracteres')
    .optional()
    .or(z.literal('')),
  location: z
    .string()
    .max(200, 'Maximo 200 caracteres')
    .optional()
    .or(z.literal('')),
  pixKey: z.string().max(100).optional().or(z.literal('')),
  pixBeneficiario: z.string().max(100).optional().or(z.literal('')),
  defaultBuyIn: z.coerce.number().min(0, 'Valor invalido').optional(),
  defaultRebuy: z.coerce.number().min(0, 'Valor invalido').optional(),
  defaultAddon: z.coerce.number().min(0, 'Valor invalido').optional(),
})

type HomeGameFormData = z.infer<typeof homeGameSchema>

export function HomeGameFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { refreshHomeGames, selectHomeGame } = useHomeGame()
  const isEditing = !!id

  const {
    data: homeGame,
    isLoading: loadingHomeGame,
    isError,
  } = useQuery({
    queryKey: ['homeGame', id],
    queryFn: () => homeGamesApi.getById(id!),
    enabled: isEditing,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HomeGameFormData>({
    resolver: zodResolver(homeGameSchema) as Resolver<HomeGameFormData>,
    defaultValues: {
      name: '',
      description: '',
      location: '',
      pixKey: '',
      pixBeneficiario: '',
      defaultBuyIn: undefined,
      defaultRebuy: undefined,
      defaultAddon: undefined,
    },
  })

  useEffect(() => {
    if (homeGame) {
      reset({
        name: homeGame.name,
        description: homeGame.description ?? '',
        location: homeGame.location ?? '',
        pixKey: '',
        pixBeneficiario: '',
        defaultBuyIn: undefined,
        defaultRebuy: undefined,
        defaultAddon: undefined,
      })
    }
  }, [homeGame, reset])

  const createMutation = useMutation({
    mutationFn: (data: HomeGameFormData) =>
      homeGamesApi.create({
        name: data.name,
        description: data.description || undefined,
        location: data.location || undefined,
      }),
    onSuccess: async (result) => {
      toast.success('Home game criado com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['homeGames'] })
      await refreshHomeGames()
      selectHomeGame(result)
      navigate(homeGameDetailPath(result.id))
    },
    onError: () => {
      toast.error('Erro ao criar home game. Tente novamente.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: HomeGameFormData) =>
      homeGamesApi.update(id!, {
        name: data.name,
        description: data.description || undefined,
        location: data.location || undefined,
      }),
    onSuccess: () => {
      toast.success('Home game atualizado com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['homeGame', id] })
      queryClient.invalidateQueries({ queryKey: ['homeGames'] })
      navigate(homeGameDetailPath(id!))
    },
    onError: () => {
      toast.error('Erro ao atualizar home game. Tente novamente.')
    },
  })

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  function onSubmit(data: HomeGameFormData) {
    if (isEditing) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  if (isEditing && loadingHomeGame) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
      </div>
    )
  }

  if (isEditing && isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-text-primary text-lg">
          Erro ao carregar o home game.
        </p>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => navigate(ROUTES.HOME_GAMES)}
        >
          Voltar
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <h1 className="text-2xl font-bold text-text-primary">
          {isEditing ? 'Editar Home Game' : 'Novo Home Game'}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {isEditing
            ? 'Altere as informacoes do home game.'
            : 'Preencha os dados para criar um novo home game.'}
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6 rounded-xl border border-border-default bg-bg-secondary p-6"
      >
        <Input
          label="Nome *"
          placeholder="Ex: Poker dos Amigos"
          error={errors.name?.message}
          {...register('name')}
        />

        <Textarea
          label="Descricao"
          placeholder="Descricao do home game..."
          error={errors.description?.message}
          {...register('description')}
        />

        <Input
          label="Local"
          placeholder="Ex: Rua das Flores, 123"
          error={errors.location?.message}
          {...register('location')}
        />

        <div className="border-t border-border-default pt-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">
            Dados PIX (para pagamentos)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Chave PIX"
              placeholder="CPF, e-mail, telefone ou chave aleatoria"
              error={errors.pixKey?.message}
              {...register('pixKey')}
            />
            <Input
              label="Beneficiario PIX"
              placeholder="Nome do beneficiario"
              error={errors.pixBeneficiario?.message}
              {...register('pixBeneficiario')}
            />
          </div>
        </div>

        <div className="border-t border-border-default pt-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">
            Valores padrao (R$)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Buy-in"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              error={errors.defaultBuyIn?.message}
              {...register('defaultBuyIn')}
            />
            <Input
              label="Rebuy"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              error={errors.defaultRebuy?.message}
              {...register('defaultRebuy')}
            />
            <Input
              label="Add-on"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              error={errors.defaultAddon?.message}
              {...register('defaultAddon')}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border-default pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEditing ? 'Salvar Alteracoes' : 'Criar Home Game'}
          </Button>
        </div>
      </form>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import * as homeGamesApi from '../../api/homeGames.api'
import * as homeGameLogoApi from '../../api/homeGameLogo.api'
import { isPlanLimitError } from '../../api/client'
import { MY_PLAN_QUERY_KEY } from '../../hooks/usePlan'
import { Input } from '../../components/ui/Input'
import { PixKeyInput } from '../../components/pix/PixKeyInput'
import type { PixKeyType } from '../../utils/pix'
import {
  buildHomeGameRequest,
  homeGameFormValues,
  homeGamePixError,
  homeGameSchema,
  useHomeGamePixVisible,
  type HomeGameFormData,
} from './homeGameForm'
import { Textarea } from '../../components/ui/Textarea'
import { Button } from '../../components/ui/Button'
import { LogoPicker } from '../../components/photo/LogoPicker'
import { ROUTES, homeGameDetailPath } from '../../constants/routes'
import { useHomeGame } from '../../hooks/useHomeGame'
import { AccessDeniedState } from '../../components/common/AccessDeniedState'
import { isForbiddenError } from '../../utils/httpErrors'

/**
 * Envia a logo escolhida (ou remove a marcada) depois de salvar o home game (SPEC-20261023-1213). Falha na logo não
 * desfaz o resto: avisa e segue.
 */
async function saveLogo(homeGameId: string, logo: Blob | null, removeCurrent: boolean): Promise<void> {
  try {
    if (logo) await homeGameLogoApi.uploadLogo(homeGameId, logo)
    else if (removeCurrent) await homeGameLogoApi.removeLogo(homeGameId)
  } catch (err) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    toast.error(msg ?? 'Home game salvo, mas a logo não foi atualizada. Tente de novo.')
  }
}

export function HomeGameFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { refreshHomeGames, selectHomeGame } = useHomeGame()
  const isEditing = !!id
  // Logo do clube: escolhida aqui e enviada ao salvar (endpoint próprio)
  const [logo, setLogo] = useState<Blob | null>(null)
  const [logoRemoved, setLogoRemoved] = useState(false)

  const {
    data: homeGame,
    isLoading: loadingHomeGame,
    isError,
    error: homeGameError,
  } = useQuery({
    queryKey: ['homeGame', id],
    queryFn: () => homeGamesApi.getById(id!),
    enabled: isEditing,
  })

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<HomeGameFormData>({
    resolver: zodResolver(homeGameSchema) as Resolver<HomeGameFormData>,
    defaultValues: homeGameFormValues(null),
  })
  // Chave PIX (SPEC-20261023-1218): tipo escolhido no campo (null = automático); seção só com pagamentos no plano
  const [pixType, setPixType] = useState<PixKeyType | null>(null)
  const pixKeyValue = useWatch({ control, name: 'pixKey' }) ?? ''
  const showPix = useHomeGamePixVisible(homeGame, isEditing)

  useEffect(() => {
    if (homeGame) {
      // Edição carrega tudo o que o PUT regrava (PIX, beneficiário e valores padrão), senão salvar apagaria
      reset(homeGameFormValues(homeGame))
    }
  }, [homeGame, reset])

  const createMutation = useMutation({
    mutationFn: async (data: HomeGameFormData) => {
      const created = await homeGamesApi.create(buildHomeGameRequest(data, pixType, null, showPix))
      await saveLogo(created.id, logo, false)
      return created
    },
    onSuccess: async (result) => {
      toast.success('Home game criado com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['homeGames'] })
      void queryClient.invalidateQueries({ queryKey: MY_PLAN_QUERY_KEY })
      await refreshHomeGames()
      selectHomeGame(result)
      navigate(homeGameDetailPath(result.id))
    },
    onError: (err: unknown) => {
      // 402 (limite de home games do plano): o UpgradeModal já abriu sozinho com o motivo
      if (isPlanLimitError(err)) return
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao criar home game. Tente novamente.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: HomeGameFormData) => {
      const updated = await homeGamesApi.update(id!, buildHomeGameRequest(data, pixType, homeGame, showPix))
      await saveLogo(updated.id, logo, logoRemoved && !!homeGame?.logoUrl)
      return updated
    },
    onSuccess: () => {
      toast.success('Home game atualizado com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['homeGame', id] })
      queryClient.invalidateQueries({ queryKey: ['homeGames'] })
      navigate(homeGameDetailPath(id!))
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao atualizar home game. Tente novamente.')
    },
  })

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  function onSubmit(data: HomeGameFormData) {
    const pixError = homeGamePixError(data, pixType, homeGame, showPix)
    if (pixError) {
      setError('pixKey', { message: pixError }, { shouldFocus: true })
      return
    }
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

  // 403: não é dono, membro nem Admin deste home game
  if (isEditing && isForbiddenError(homeGameError)) {
    return <AccessDeniedState />
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
          {isEditing ? 'Editar home game' : 'Novo home game'}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {isEditing
            ? 'Altere as informações do home game.'
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
          label="Descrição"
          placeholder="Descrição do home game..."
          error={errors.description?.message}
          {...register('description')}
        />

        <Input
          label="Local"
          placeholder="Ex: Rua das Flores, 123"
          error={errors.location?.message}
          {...register('location')}
        />

        <LogoPicker
          currentUrl={homeGame?.logoUrl}
          value={logo}
          onChange={setLogo}
          removed={logoRemoved}
          onRemovedChange={setLogoRemoved}
          disabled={isSubmitting}
        />

        {/* Dados PIX só com pagamentos no plano (SPEC-20261023-1218); a chave aceita do jeito que a pessoa digita */}
        {showPix && (
          <div className="border-t border-border-default pt-4">
            <h3 className="text-sm font-medium text-text-secondary mb-3">
              Dados PIX (para pagamentos)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:items-start">
              <PixKeyInput
                id="home-game-page-pix-key"
                label="Chave PIX"
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
                savedKey={homeGame?.pixKey ?? null}
                error={errors.pixKey?.message}
                disabled={isSubmitting}
              />
              <Input
                id="home-game-page-pix-beneficiary"
                label="Beneficiário PIX"
                placeholder="Nome do beneficiário"
                error={errors.pixBeneficiary?.message}
                {...register('pixBeneficiary')}
              />
            </div>
          </div>
        )}

        <div className="border-t border-border-default pt-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">
            Valores padrão (R$)
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
            {isEditing ? 'Salvar alterações' : 'Criar home game'}
          </Button>
        </div>
      </form>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as homeGamesApi from '../../api/homeGames.api'
import * as homeGameLogoApi from '../../api/homeGameLogo.api'
import { isPlanLimitError } from '../../api/client'
import { MY_PLAN_QUERY_KEY } from '../../hooks/usePlan'
import { Modal } from '../../components/ui/Modal'
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
import type { HomeGame } from '../../types/homeGame.types'

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

interface HomeGameFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  homeGame?: HomeGame | null
}

export function HomeGameFormModal({
  isOpen,
  onClose,
  onSuccess,
  homeGame,
}: HomeGameFormModalProps) {
  const isEditing = !!homeGame
  // Logo do clube: escolhida aqui e enviada ao salvar (endpoint próprio)
  const [logo, setLogo] = useState<Blob | null>(null)
  const [logoRemoved, setLogoRemoved] = useState(false)
  // Chave PIX (SPEC-20261023-1218): tipo escolhido no campo (null = automático)
  const [pixType, setPixType] = useState<PixKeyType | null>(null)
  // Abriu de novo: começa sem logo escolhida e com o tipo da chave automático (ajuste de estado durante o render)
  const [wasOpen, setWasOpen] = useState(isOpen)
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen)
    if (isOpen) {
      setLogo(null)
      setLogoRemoved(false)
      setPixType(null)
    }
  }
  // Dados PIX só com pagamentos no plano (do dono na edição; da própria conta na criação)
  const showPix = useHomeGamePixVisible(homeGame, isEditing)

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
  const pixKeyValue = useWatch({ control, name: 'pixKey' }) ?? ''

  useEffect(() => {
    // Edição carrega tudo o que o PUT regrava (PIX, beneficiário e valores padrão), senão salvar apagaria
    if (isOpen) reset(homeGameFormValues(homeGame))
  }, [isOpen, homeGame, reset])

  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: async (data: HomeGameFormData) => {
      const created = await homeGamesApi.create(buildHomeGameRequest(data, pixType, null, showPix))
      await saveLogo(created.id, logo, false)
      return created
    },
    onSuccess: () => {
      toast.success('Home game criado com sucesso!')
      void queryClient.invalidateQueries({ queryKey: MY_PLAN_QUERY_KEY })
      onSuccess()
    },
    onError: (err: unknown) => {
      // 402 (limite de home games do plano): o UpgradeModal já abriu sozinho; este formulário fecha
      // para o modal de upgrade ficar sozinho na tela (SPEC-20261023-1205)
      if (isPlanLimitError(err)) {
        onClose()
        return
      }
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao criar home game. Tente novamente.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: HomeGameFormData) => {
      const updated = await homeGamesApi.update(homeGame!.id, buildHomeGameRequest(data, pixType, homeGame, showPix))
      await saveLogo(updated.id, logo, logoRemoved && !!homeGame?.logoUrl)
      return updated
    },
    onSuccess: () => {
      toast.success('Home game atualizado com sucesso!')
      onSuccess()
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

  // No celular o ✓ do cabeçalho faz o mesmo que o botão do rodapé e o rodapé some (SPEC-20261027-2132)
  const submitAction = { label: isEditing ? 'Salvar' : 'Criar home game', form: 'home-game-form', loading: isSubmitting }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar home game' : 'Novo home game'}
      size="lg"
      submitAction={submitAction}
      footer={
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="submit" form="home-game-form" loading={isSubmitting}>
            {isEditing ? 'Salvar' : 'Criar home game'}
          </Button>
        </div>
      }
    >
      <form id="home-game-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                id="home-game-modal-pix-key"
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
                id="home-game-modal-pix-beneficiary"
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
      </form>
    </Modal>
  )
}

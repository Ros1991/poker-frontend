import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as homeGamesApi from '../../api/homeGames.api'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { Button } from '../../components/ui/Button'
import type { HomeGame } from '../../types/homeGame.types'

const homeGameSchema = z.object({
  name: z.string().min(1, 'Nome e obrigatorio').max(100, 'Maximo 100 caracteres'),
  description: z.string().max(500, 'Maximo 500 caracteres').optional().or(z.literal('')),
  location: z.string().max(200, 'Maximo 200 caracteres').optional().or(z.literal('')),
  pixKey: z.string().max(100).optional().or(z.literal('')),
  pixBeneficiario: z.string().max(100).optional().or(z.literal('')),
  defaultBuyIn: z.coerce.number().min(0, 'Valor invalido').optional(),
  defaultRebuy: z.coerce.number().min(0, 'Valor invalido').optional(),
  defaultAddon: z.coerce.number().min(0, 'Valor invalido').optional(),
})

type HomeGameFormData = z.infer<typeof homeGameSchema>

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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HomeGameFormData>({
    resolver: zodResolver(homeGameSchema),
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
    if (isOpen) {
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
      } else {
        reset({
          name: '',
          description: '',
          location: '',
          pixKey: '',
          pixBeneficiario: '',
          defaultBuyIn: undefined,
          defaultRebuy: undefined,
          defaultAddon: undefined,
        })
      }
    }
  }, [isOpen, homeGame, reset])

  const createMutation = useMutation({
    mutationFn: (data: HomeGameFormData) =>
      homeGamesApi.create({
        name: data.name,
        description: data.description || undefined,
        location: data.location || undefined,
      }),
    onSuccess: () => {
      toast.success('Home game criado com sucesso!')
      onSuccess()
    },
    onError: () => {
      toast.error('Erro ao criar home game. Tente novamente.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: HomeGameFormData) =>
      homeGamesApi.update(homeGame!.id, {
        id: homeGame!.id,
        name: data.name,
        description: data.description || undefined,
        location: data.location || undefined,
      }),
    onSuccess: () => {
      toast.success('Home game atualizado com sucesso!')
      onSuccess()
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Home Game' : 'Novo Home Game'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEditing ? 'Salvar' : 'Criar Home Game'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

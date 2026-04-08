import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Users } from 'lucide-react'
import { toast } from 'sonner'
import * as personsApi from '../../api/persons.api'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { Button } from '../../components/ui/Button'
import { FileUpload } from '../../components/ui/FileUpload'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { ROUTES } from '../../constants/routes'
import { useHomeGame } from '../../contexts/HomeGameContext'

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

const personSchema = z.object({
  fullName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  nickname: z.string().optional(),
  email: z.union([z.email('E-mail inválido'), z.literal('')]).optional(),
  whatsapp: z.string().optional(),
  notes: z.string().optional(),
})

type PersonFormData = z.infer<typeof personSchema>

export function PlayerFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const { selectedHomeGame } = useHomeGame()

  const { data: person, isLoading: isLoadingPerson } = useQuery({
    queryKey: ['person', id],
    queryFn: () => personsApi.getById(id!),
    enabled: isEditing,
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PersonFormData>({
    resolver: zodResolver(personSchema),
    values: person
      ? {
          fullName: person.fullName,
          nickname: person.nickname ?? '',
          email: person.email ?? '',
          whatsapp: person.whatsapp ?? '',
          notes: '',
        }
      : undefined,
  })

  const createMutation = useMutation({
    mutationFn: personsApi.create,
    onSuccess: async (created) => {
      if (photoFile) {
        try {
          await personsApi.uploadPhoto(created.id, photoFile)
        } catch {
          toast.error('Jogador criado, mas houve erro ao enviar a foto.')
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['persons'] })
      toast.success('Jogador criado com sucesso!')
      navigate(ROUTES.PLAYERS)
    },
    onError: () => {
      toast.error('Erro ao criar jogador.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: PersonFormData) => personsApi.update(id!, data),
    onSuccess: async () => {
      if (photoFile) {
        try {
          await personsApi.uploadPhoto(id!, photoFile)
        } catch {
          toast.error('Jogador atualizado, mas houve erro ao enviar a foto.')
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['persons'] })
      await queryClient.invalidateQueries({ queryKey: ['person', id] })
      toast.success('Jogador atualizado com sucesso!')
      navigate(ROUTES.PLAYERS)
    },
    onError: () => {
      toast.error('Erro ao atualizar jogador.')
    },
  })

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  function onSubmit(data: PersonFormData) {
    const digits = data.whatsapp?.replace(/\D/g, '') || undefined
    // Salvar apenas dígitos locais (sem +55): ex 11999999999
    const whatsapp = digits
      ? digits.startsWith('55') && digits.length > 11
        ? digits.slice(2)
        : digits
      : undefined

    if (isEditing) {
      updateMutation.mutate({ ...data, whatsapp })
    } else {
      createMutation.mutate({
        homeGameId: selectedHomeGame!.id,
        type: 'Jogador',
        fullName: data.fullName,
        nickname: data.nickname || undefined,
        email: data.email || undefined,
        whatsapp,
      })
    }
  }

  if (!isEditing && !selectedHomeGame) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <Users className="h-12 w-12 text-text-muted" />
        <p className="text-lg font-medium text-text-secondary">
          Selecione um Home Game primeiro
        </p>
      </div>
    )
  }

  if (isEditing && isLoadingPerson) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" text="Carregando jogador..." />
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
            {isEditing ? 'Editar Jogador' : 'Novo Jogador'}
          </h1>
          <p className="text-sm text-text-secondary">
            {isEditing
              ? 'Atualize as informações do jogador'
              : 'Preencha os dados para cadastrar um novo jogador'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="flex flex-col gap-6 rounded-xl border border-border-default bg-bg-secondary p-6 max-w-2xl"
      >
        <FileUpload
          label="Foto"
          onFileSelect={setPhotoFile}
          currentUrl={person?.photoUrl}
        />

        <Input
          label="Nome Completo *"
          placeholder="Nome completo do jogador"
          error={errors.fullName?.message}
          {...register('fullName')}
        />

        <Input
          label="Apelido"
          placeholder="Apelido ou nome de mesa"
          error={errors.nickname?.message}
          {...register('nickname')}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="E-mail"
            type="email"
            placeholder="jogador@email.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="WhatsApp"
            type="tel"
            placeholder="(11) 99999-9999"
            error={errors.whatsapp?.message}
            value={formatPhone(watch('whatsapp') ?? '')}
            onChange={(e) =>
              setValue('whatsapp', formatPhone(e.target.value), {
                shouldValidate: true,
              })
            }
            name="whatsapp"
          />
        </div>

        <Textarea
          label="Notas"
          placeholder="Observações sobre o jogador..."
          rows={3}
          {...register('notes')}
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
            {isEditing ? 'Salvar Alterações' : 'Cadastrar Jogador'}
          </Button>
        </div>
      </form>
    </div>
  )
}

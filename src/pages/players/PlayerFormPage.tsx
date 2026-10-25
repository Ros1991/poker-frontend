import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Users } from 'lucide-react'
import { toast } from 'sonner'
import * as personsApi from '../../api/persons.api'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { PlayerFormFields } from '../../components/players/PlayerFormFields'
import {
  EMPTY_PLAYER_FORM,
  playerFormFromPerson,
  validatePlayerForm,
} from '../../components/players/playerForm'
import type { PlayerFormErrors, PlayerFormValue } from '../../components/players/playerForm'
import { ROUTES } from '../../constants/routes'
import { useHomeGame } from '../../hooks/useHomeGame'
import type { Person } from '../../types/person.types'
import { cleanWhatsapp } from '../../utils/phone'
import { normalizeSpaces } from '../../utils/text'

function serverMessage(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message
}

/**
 * /players/new e /players/:id/edit (SPEC-20261023-1213, F17): os mesmos campos do cadastro com foto
 * (PlayerFormFields), mais e-mail e notas. Editar não apaga as notas (vêm da pessoa); "Remover foto" remove de verdade.
 */
export function PlayerFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const { selectedHomeGame } = useHomeGame()

  const { data: person, isLoading: isLoadingPerson, isError } = useQuery({
    queryKey: ['person', id],
    queryFn: () => personsApi.getById(id!),
    enabled: isEditing,
  })

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

  if (isEditing && isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <Users className="h-12 w-12 text-text-muted" />
        <p className="text-lg font-medium text-text-secondary">Não foi possível carregar o jogador.</p>
      </div>
    )
  }

  if (isEditing && (isLoadingPerson || !person)) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" text="Carregando jogador..." />
      </div>
    )
  }

  // Monta o formulário só com a pessoa carregada: o valor inicial já vem com as notas dela
  return <PlayerForm key={person?.id ?? 'novo'} person={person ?? null} homeGameId={person?.homeGameId ?? selectedHomeGame!.id} />
}

function PlayerForm({ person, homeGameId }: { person: Person | null; homeGameId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditing = !!person
  const [value, setValue] = useState<PlayerFormValue>(() => (person ? playerFormFromPerson(person) : EMPTY_PLAYER_FORM))
  const [errors, setErrors] = useState<PlayerFormErrors>({})
  const [saving, setSaving] = useState(false)

  function patch(p: Partial<PlayerFormValue>) {
    setValue((v) => ({ ...v, ...p }))
    setErrors((e) => {
      const next = { ...e }
      for (const k of Object.keys(p)) delete next[k as keyof PlayerFormErrors]
      return next
    })
  }

  async function onSubmit() {
    const found = validatePlayerForm(value, { checkEmail: true })
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    const data = {
      fullName: normalizeSpaces(value.fullName),
      nickname: normalizeSpaces(value.nickname),
      email: value.email.trim(),
      whatsapp: cleanWhatsapp(value.whatsapp) ?? '',
      notes: value.notes,
    }
    let saved: Person
    try {
      saved = person
        ? await personsApi.update(person.id, data)
        : await personsApi.create({
            homeGameId,
            type: 'Jogador',
            fullName: data.fullName,
            nickname: data.nickname || undefined,
            email: data.email || undefined,
            whatsapp: data.whatsapp || undefined,
            notes: data.notes || undefined,
          })
    } catch (err) {
      setSaving(false)
      toast.error(serverMessage(err) || (isEditing ? 'Erro ao atualizar jogador.' : 'Erro ao criar jogador.'))
      return
    }

    try {
      if (value.photo) await personsApi.uploadPhoto(saved.id, value.photo)
      else if (person?.photoUrl && value.photoRemoved) await personsApi.removePhoto(saved.id)
      toast.success(isEditing ? 'Jogador atualizado com sucesso!' : 'Jogador criado com sucesso!')
    } catch (err) {
      toast.error(
        serverMessage(err) ??
          (isEditing
            ? 'Jogador atualizado, mas houve erro ao salvar a foto.'
            : 'Jogador criado, mas houve erro ao enviar a foto.'),
      )
    } finally {
      setSaving(false)
    }

    await queryClient.invalidateQueries({ queryKey: ['persons'] })
    await queryClient.invalidateQueries({ queryKey: ['person', saved.id] })
    navigate(ROUTES.PLAYERS)
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {isEditing ? 'Editar jogador' : 'Novo jogador'}
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
        onSubmit={(e) => {
          e.preventDefault()
          void onSubmit()
        }}
        className="flex flex-col gap-6 rounded-xl border border-border-default bg-bg-secondary p-6 max-w-2xl"
      >
        <PlayerFormFields
          value={value}
          onChange={patch}
          errors={errors}
          currentPhotoUrl={person?.photoUrl}
          allowRemovePhoto={isEditing}
          showEmail
          showNotes
          disabled={saving}
          idPrefix="pagina-jogador"
        />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {isEditing ? 'Salvar alterações' : 'Cadastrar jogador'}
          </Button>
        </div>
      </form>
    </div>
  )
}

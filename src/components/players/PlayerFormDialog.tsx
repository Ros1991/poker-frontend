import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as personsApi from '../../api/persons.api'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import type { Person } from '../../types/person.types'
import { cleanWhatsapp } from '../../utils/phone'
import { normalizeSpaces } from '../../utils/text'
import { PlayerFormFields } from './PlayerFormFields'
import { EMPTY_PLAYER_FORM, findSameName, playerFormFromPerson, validatePlayerForm } from './playerForm'
import type { PlayerFormErrors, PlayerFormValue } from './playerForm'

interface PlayerFormDialogProps {
  isOpen: boolean
  onClose: () => void
  homeGameId: string
  /** Pessoa em edição; null/undefined = cadastro novo */
  person?: Person | null
  /** Jogadores do home game, para barrar nome repetido antes de enviar */
  existing?: readonly Person[]
  onSaved?: (person: Person) => void
}

function serverMessage(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message
}

/**
 * "Novo jogador" e "Editar" da aba Jogadores do home game (SPEC-20261023-1213, F17): os mesmos campos do cadastro
 * pelo torneio, com foto (tirar na hora, galeria ou webcam; recorte quadrado). Criar = POST /Persons + foto;
 * editar = PUT + foto nova ou remover. Fecha só no X/Cancelar ou ao salvar.
 */
export function PlayerFormDialog(props: PlayerFormDialogProps) {
  if (!props.isOpen) return null
  return <PlayerFormDialogContent {...props} />
}

function PlayerFormDialogContent({ onClose, homeGameId, person, existing = [], onSaved }: PlayerFormDialogProps) {
  const queryClient = useQueryClient()
  const editing = !!person
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

  async function save() {
    const found = validatePlayerForm(value)
    const same = findSameName(existing, value.fullName, person?.id)
    if (!found.fullName && same) found.fullName = `Já existe ${same.nickname || same.fullName} com esse nome no home game.`
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    const fullName = normalizeSpaces(value.fullName)
    const nickname = normalizeSpaces(value.nickname)
    const whatsapp = cleanWhatsapp(value.whatsapp)
    let saved: Person
    try {
      saved = editing
        ? await personsApi.update(person!.id, { fullName, nickname, whatsapp: whatsapp ?? '' })
        : await personsApi.create({
            homeGameId,
            type: 'Jogador',
            fullName,
            nickname: nickname || undefined,
            whatsapp,
          })
    } catch (err) {
      setSaving(false)
      toast.error(serverMessage(err) || (editing ? 'Não foi possível salvar o jogador.' : 'Não foi possível cadastrar o jogador.'))
      return
    }

    try {
      if (value.photo) saved = await personsApi.uploadPhoto(saved.id, value.photo)
      else if (editing && value.photoRemoved && person?.photoUrl) saved = await personsApi.removePhoto(saved.id)
      toast.success(editing ? 'Jogador atualizado' : 'Jogador cadastrado')
    } catch (err) {
      toast.error(
        serverMessage(err) ??
          (editing
            ? 'Dados salvos, mas a foto não foi atualizada. Toque no avatar para tentar de novo.'
            : 'Jogador cadastrado, mas a foto não foi enviada. Toque no avatar para tentar de novo.'),
      )
    } finally {
      setSaving(false)
    }

    void queryClient.invalidateQueries({ queryKey: ['persons', homeGameId] })
    void queryClient.invalidateQueries({ queryKey: ['person', saved.id] })
    onSaved?.(saved)
    onClose()
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editing ? 'Editar jogador' : 'Novo jogador'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            {editing ? 'Salvar' : 'Cadastrar jogador'}
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <PlayerFormFields
          value={value}
          onChange={patch}
          errors={errors}
          currentPhotoUrl={person?.photoUrl}
          allowRemovePhoto={editing}
          autoFocusName={!editing}
          disabled={saving}
          idPrefix={editing ? 'editar-jogador' : 'novo-jogador'}
        />
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  )
}

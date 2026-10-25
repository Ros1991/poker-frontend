// Valor e validação do formulário de jogador (SPEC-20261023-1213, F10) — fora do PlayerFormFields.tsx porque
// arquivo de componente só exporta componentes (react-refresh/only-export-components).
import type { Person } from '../../types/person.types'
import { cleanWhatsapp, isValidWhatsapp } from '../../utils/phone'
import { nameKey, normalizeSpaces } from '../../utils/text'

export interface PlayerFormValue {
  fullName: string
  nickname: string
  /** Só dígitos (a máscara é da tela) */
  whatsapp: string
  email: string
  notes: string
  /** Foto nova escolhida e recortada (ainda não enviada) */
  photo: Blob | null
  /** A foto salva foi marcada para remover */
  photoRemoved: boolean
}

export type PlayerFormErrors = Partial<Record<'fullName' | 'nickname' | 'whatsapp' | 'email', string>>

export const EMPTY_PLAYER_FORM: PlayerFormValue = {
  fullName: '',
  nickname: '',
  whatsapp: '',
  email: '',
  notes: '',
  photo: null,
  photoRemoved: false,
}

/** Formulário preenchido com a pessoa (edição). As notas vêm da pessoa: editar não apaga as notas */
export function playerFormFromPerson(person: Person): PlayerFormValue {
  return {
    fullName: person.fullName ?? '',
    nickname: person.nickname ?? '',
    whatsapp: cleanWhatsapp(person.whatsapp) ?? '',
    email: person.email ?? '',
    notes: person.notes ?? '',
    photo: null,
    photoRemoved: false,
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Nome 2–120 (obrigatório), apelido até 60, WhatsApp com DDD (10–11 dígitos) quando informado, e-mail válido */
export function validatePlayerForm(value: PlayerFormValue, { checkEmail = false } = {}): PlayerFormErrors {
  const errors: PlayerFormErrors = {}
  const name = normalizeSpaces(value.fullName)
  if (name.length < 2 || name.length > 120) errors.fullName = 'Informe o nome completo (de 2 a 120 letras).'
  if (normalizeSpaces(value.nickname).length > 60) errors.nickname = 'O apelido pode ter no máximo 60 letras.'
  if (value.whatsapp && !isValidWhatsapp(value.whatsapp)) errors.whatsapp = 'WhatsApp com DDD: 10 ou 11 dígitos.'
  if (checkEmail && value.email.trim() && !EMAIL_RE.test(value.email.trim())) errors.email = 'E-mail inválido.'
  return errors
}

/** Mesmo nome (sem diferença de maiúsculas e espaços) numa lista — a regra do servidor (F11) */
export function findSameName<T extends { id: string; fullName: string }>(
  list: readonly T[],
  fullName: string,
  exceptId?: string,
): T | undefined {
  const key = nameKey(fullName)
  return list.find((p) => p.id !== exceptId && nameKey(p.fullName) === key)
}

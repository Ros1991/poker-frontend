import { useState } from 'react'
import { UserCheck } from 'lucide-react'
import * as personsApi from '../../api/persons.api'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { PhotoPicker } from '../photo/PhotoPicker'
import type { AccountLookup } from '../../types/person.types'
import { formatPhone, whatsappInput } from '../../utils/phone'
import { normalizeSpaces } from '../../utils/text'
import { isPlausibleEmail } from './playerForm'
import type { LinkedAccountInfo, PlayerFormErrors, PlayerFormValue } from './playerForm'

/**
 * Fonte de 16 px nos campos no celular (SPEC-20261027-1311): abaixo disso o iPhone dá zoom ao focar e o campo passa da
 * borda da tela. A partir de `sm` volta ao tamanho do resto do painel.
 */
const FIELD_TEXT = 'text-base sm:text-sm'

interface PlayerFormFieldsProps {
  value: PlayerFormValue
  onChange: (patch: Partial<PlayerFormValue>) => void
  errors?: PlayerFormErrors
  /** Foto do CADASTRO já salva (edição) — a própria do jogador, não a da conta vinculada */
  currentPhotoUrl?: string | null
  /** "Remover foto" da foto salva (só o organizador) */
  allowRemovePhoto?: boolean
  /** E-mail: no painel e no cadastro pelo torneio do organizador; o dealer por QR não informa (SPEC-20261029-1725) */
  showEmail?: boolean
  /** Notas: só na tela /players */
  showNotes?: boolean
  /** Explica que o WhatsApp não volta para o dealer */
  whatsappHint?: string
  autoFocusName?: boolean
  disabled?: boolean
  /** Prefixo dos ids dos campos (dois formulários na mesma tela) */
  idPrefix?: string
  /**
   * "Já conhecemos este jogador" (SPEC-20261029-1725): ao sair do campo de e-mail, procura a conta confirmada com ele no
   * escopo do cadastro (home game ou torneio). Sem escopo, sem busca. Só quem gerencia o home game recebe resposta
   * (fora disso o servidor responde 403 e o card simplesmente não aparece).
   */
  lookupScope?: { homeGameId?: string; tournamentId?: string }
  /** Jogador já vinculado a uma conta (edição): o aviso "A foto vem da conta de Fulano" */
  linkedAccount?: LinkedAccountInfo | null
}

/** Chave da busca: o e-mail sem espaços nas pontas e minúsculo (a mesma regra do servidor) */
const emailKey = (email: string) => email.trim().toLowerCase()

/**
 * Campos do jogador (SPEC-20261023-1213, F10/F17): Foto, Nome completo (obrigatório, 2–120), E-mail, Apelido (o que
 * aparece na mesa e no telão), WhatsApp e, só na tela /players, Notas. Um formulário só para o cadastro pelo torneio
 * (painel e terminal), a aba Jogadores do home game e /players/new|:id/edit.
 * Conta vinculada (SPEC-20261029-1725): ao sair do e-mail, se houver conta confirmada com ele, aparece "Já conhecemos
 * este jogador" com a foto e o nome da conta, e nome/apelido vazios são preenchidos com os dela (com nome já digitado e
 * diferente, o card oferece "Usar nome e apelido da conta"). Na edição de jogador vinculado, o aviso diz de onde vem a
 * foto; a foto do cadastro continua editável e vale só quando a conta não tem foto.
 */
export function PlayerFormFields({
  value,
  onChange,
  errors = {},
  currentPhotoUrl,
  allowRemovePhoto = false,
  showEmail = false,
  showNotes = false,
  whatsappHint,
  autoFocusName = false,
  disabled = false,
  idPrefix = 'jogador',
  lookupScope,
  linkedAccount,
}: PlayerFormFieldsProps) {
  const displayName = value.nickname.trim() || value.fullName.trim()
  // Respostas da busca por e-mail (chave = e-mail normalizado): cada e-mail é procurado uma vez por formulário
  const [lookups, setLookups] = useState<Record<string, AccountLookup>>({})
  const currentKey = emailKey(value.email)
  const found = showEmail && lookupScope && currentKey ? lookups[currentKey] : undefined
  const known = found?.found ? found : null

  async function lookupEmail() {
    if (!showEmail || !lookupScope) return
    const email = value.email.trim()
    const key = emailKey(email)
    if (!isPlausibleEmail(email) || key in lookups) return
    let result: AccountLookup
    try {
      result = await personsApi.lookupEmail(email, lookupScope)
    } catch {
      // 403 (não gerencia o home game), 429 (muitas buscas) ou sem conexão: sem card, o cadastro segue igual
      return
    }
    setLookups((prev) => ({ ...prev, [key]: result }))
    if (!result.found) return
    // Preenche só o que está vazio: nome/apelido já digitados não são trocados sem pedir
    const patch: Partial<PlayerFormValue> = {}
    if (!value.fullName.trim() && result.fullName) patch.fullName = result.fullName
    if (!value.nickname.trim() && result.nickname) patch.nickname = result.nickname
    if (Object.keys(patch).length > 0) onChange(patch)
  }

  // Nome ou apelido digitados diferentes dos da conta: o card oferece trocar
  const namesDiffer =
    !!known &&
    ((!!known.fullName && normalizeSpaces(value.fullName) !== known.fullName) ||
      (!!known.nickname && normalizeSpaces(value.nickname) !== known.nickname))
  const photoFromAccount = !!linkedAccount?.photoFromAccount

  const emailField = showEmail && (
    <div className="flex flex-col gap-2">
      <Input
        id={`${idPrefix}-email`}
        label="E-mail"
        type="email"
        inputMode="email"
        placeholder="jogador@email.com"
        value={value.email}
        autoComplete="off"
        disabled={disabled}
        className={FIELD_TEXT}
        error={errors.email}
        helperText={
          errors.email || !lookupScope ? undefined : 'Opcional. Com o e-mail da conta do jogador, vale a foto da conta.'
        }
        onChange={(e) => onChange({ email: e.target.value })}
        onBlur={() => void lookupEmail()}
      />
      {known && (
        <div
          role="status"
          data-account-known
          className="flex items-start gap-3 rounded-lg border border-accent-blue bg-accent-blue-soft p-3"
        >
          <Avatar src={known.photoUrl} name={known.fullName || '?'} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
              <UserCheck className="h-4 w-4 shrink-0 text-accent-blue" aria-hidden="true" />
              Já conhecemos este jogador
            </p>
            <p className="break-words text-sm text-text-primary">
              {known.fullName}
              {known.nickname ? ` (${known.nickname})` : ''}
            </p>
            <p className="text-xs text-text-secondary">
              {known.photoUrl
                ? 'A foto da conta aparece no lugar da foto do cadastro, em todo home game.'
                : 'A conta ainda está sem foto: vale a foto do cadastro.'}
            </p>
            {namesDiffer && (
              <Button
                type="button"
                variant="secondary"
                className="mt-1.5 self-start"
                disabled={disabled}
                onClick={() =>
                  onChange({
                    fullName: known.fullName || value.fullName,
                    nickname: known.nickname ?? value.nickname,
                  })
                }
              >
                Usar nome e apelido da conta
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        {linkedAccount && (
          <div
            data-photo-source
            className="mb-1 flex items-center gap-3 rounded-lg border border-border-default bg-bg-tertiary p-3"
          >
            {photoFromAccount && <Avatar src={linkedAccount.photoUrl} name={linkedAccount.name} size="md" />}
            <p className="min-w-0 flex-1 text-sm text-text-primary">
              {photoFromAccount ? (
                <>
                  A foto vem da conta de <strong className="font-semibold">{linkedAccount.name}</strong>. A foto abaixo é
                  a do cadastro: só aparece se a conta ficar sem foto.
                </>
              ) : (
                <>
                  Jogador vinculado à conta de <strong className="font-semibold">{linkedAccount.name}</strong>, que está
                  sem foto: vale a foto do cadastro.
                </>
              )}
            </p>
          </div>
        )}
        <span className="text-sm font-medium text-text-secondary">
          {photoFromAccount ? 'Foto do cadastro (opcional)' : 'Foto (opcional)'}
        </span>
        <PhotoPicker
          name={displayName || '?'}
          currentUrl={currentPhotoUrl}
          value={value.photo}
          onChange={(photo) => onChange({ photo })}
          allowRemove={allowRemovePhoto}
          removed={value.photoRemoved}
          onRemovedChange={(photoRemoved) => onChange({ photoRemoved })}
          size="xl"
          disabled={disabled}
        />
      </div>
      <Input
        id={`${idPrefix}-nome`}
        label="Nome completo *"
        placeholder="Nome e sobrenome"
        value={value.fullName}
        maxLength={120}
        autoFocus={autoFocusName}
        autoComplete="off"
        disabled={disabled}
        className={FIELD_TEXT}
        error={errors.fullName}
        onChange={(e) => onChange({ fullName: e.target.value })}
      />
      {emailField}
      <Input
        id={`${idPrefix}-apelido`}
        label="Apelido"
        placeholder="Como aparece na mesa e no telão"
        value={value.nickname}
        maxLength={60}
        autoComplete="off"
        disabled={disabled}
        className={FIELD_TEXT}
        error={errors.nickname}
        onChange={(e) => onChange({ nickname: e.target.value })}
      />
      <Input
        id={`${idPrefix}-whatsapp`}
        label="WhatsApp"
        type="tel"
        inputMode="tel"
        placeholder="(11) 99999-9999"
        value={formatPhone(value.whatsapp)}
        autoComplete="off"
        disabled={disabled}
        className={FIELD_TEXT}
        error={errors.whatsapp}
        helperText={errors.whatsapp ? undefined : whatsappHint}
        // Normaliza antes de limitar: colar "+55 (11) 98765-4321" ou "011 98765-4321" vira 11987654321
        onChange={(e) => onChange({ whatsapp: whatsappInput(e.target.value) })}
      />
      {showNotes && (
        <Textarea
          id={`${idPrefix}-notas`}
          label="Notas"
          placeholder="Observações sobre o jogador..."
          rows={3}
          value={value.notes}
          disabled={disabled}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      )}
    </div>
  )
}

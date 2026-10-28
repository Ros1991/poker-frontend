import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { PhotoPicker } from '../photo/PhotoPicker'
import { formatPhone, whatsappInput } from '../../utils/phone'
import type { PlayerFormErrors, PlayerFormValue } from './playerForm'

/**
 * Fonte de 16 px nos campos no celular (SPEC-20261027-1311): abaixo disso o iPhone dá zoom ao focar e o campo passa da
 * borda da tela. A partir de `sm` volta ao tamanho do resto do painel.
 */
const FIELD_TEXT = 'text-base sm:text-sm'

interface PlayerFormFieldsProps {
  value: PlayerFormValue
  onChange: (patch: Partial<PlayerFormValue>) => void
  errors?: PlayerFormErrors
  /** Foto já salva (edição) */
  currentPhotoUrl?: string | null
  /** "Remover foto" da foto salva (só o organizador) */
  allowRemovePhoto?: boolean
  /** E-mail e Notas: só na tela /players (o cadastro rápido não pede) */
  showEmail?: boolean
  showNotes?: boolean
  /** Explica que o WhatsApp não volta para o dealer */
  whatsappHint?: string
  autoFocusName?: boolean
  disabled?: boolean
  /** Prefixo dos ids dos campos (dois formulários na mesma tela) */
  idPrefix?: string
}

/**
 * Campos do jogador (SPEC-20261023-1213, F10/F17): Foto, Nome completo (obrigatório, 2–120), Apelido (o que aparece
 * na mesa e no telão), WhatsApp e, só na tela /players, E-mail e Notas. Um formulário só para o cadastro pelo
 * torneio (painel e terminal), a aba Jogadores do home game e /players/new|:id/edit.
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
}: PlayerFormFieldsProps) {
  const displayName = value.nickname.trim() || value.fullName.trim()
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text-secondary">Foto (opcional)</span>
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
      {showEmail && (
        <Input
          id={`${idPrefix}-email`}
          label="E-mail"
          type="email"
          placeholder="jogador@email.com"
          value={value.email}
          autoComplete="off"
          disabled={disabled}
          className={FIELD_TEXT}
          error={errors.email}
          onChange={(e) => onChange({ email: e.target.value })}
        />
      )}
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

import { useState } from 'react'
import type { FormEvent } from 'react'
import * as meApi from '../../api/me.api'
import { EditablePhotoAvatar } from '../../components/photo/EditablePhotoAvatar'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import type { Profile } from '../../types/profile.types'
import { formatPhone, isValidWhatsapp, whatsappInput } from '../../utils/phone'
import type { ProfileDraft, ProfileDraftErrors } from './welcomeFlow'

function validate(value: ProfileDraft): ProfileDraftErrors {
  const errors: ProfileDraftErrors = {}
  if (value.nickname.trim().length > 100) errors.nickname = 'O apelido deve ter no máximo 100 caracteres.'
  if (value.whatsapp && !isValidWhatsapp(value.whatsapp)) errors.whatsapp = 'WhatsApp com DDD: 10 ou 11 dígitos.'
  return errors
}

interface ProfileStepProps {
  profile: Profile
  initial: ProfileDraft
  /** Erro que o servidor devolveu ao concluir (a página volta para esta etapa com ele) */
  serverErrors?: ProfileDraftErrors
  onContinue: (draft: ProfileDraft) => void
  /** "Fazer depois": segue para o plano sem mexer no perfil */
  onSkip: () => void
  /** Foto enviada/removida aqui (vai na hora, pelo mesmo upload do Meu perfil) */
  onProfileChange: (profile: Profile) => void
}

/**
 * Etapa 1 das boas-vindas — Completar cadastro (SPEC-20261023-1212): foto (a do Google, se veio de lá, com a opção
 * de não usar; ou enviar uma, sempre redonda), apelido e WhatsApp (55 + DDD + número no servidor). Tudo opcional:
 * "Fazer depois" segue sem mexer em nada e dá para completar em Meu perfil.
 */
export function ProfileStep({ profile, initial, serverErrors, onContinue, onSkip, onProfileChange }: ProfileStepProps) {
  const [value, setValue] = useState<ProfileDraft>(initial)
  const [errors, setErrors] = useState<ProfileDraftErrors>(serverErrors ?? {})

  const providerPhoto = profile.photoFromProvider === true && !!profile.photoUrl
  const keepProviderPhoto = providerPhoto && value.useProviderPhoto !== false
  const shownPhoto = providerPhoto ? (keepProviderPhoto ? profile.photoUrl : null) : profile.photoUrl
  const firstName = profile.fullName.trim().split(/\s+/)[0] || profile.fullName

  function change(patch: Partial<ProfileDraft>) {
    setValue((v) => ({ ...v, ...patch }))
    setErrors((e) => {
      const next = { ...e }
      for (const key of Object.keys(patch) as (keyof ProfileDraftErrors)[]) delete next[key]
      return next
    })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const found = validate(value)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    onContinue({
      nickname: value.nickname.trim(),
      whatsapp: value.whatsapp,
      useProviderPhoto: providerPhoto ? keepProviderPhoto : null,
    })
  }

  return (
    <section className="rounded-xl border border-border-default bg-bg-card p-5 shadow-sm sm:p-6" aria-labelledby="boas-vindas-titulo">
      <h1 id="boas-vindas-titulo" className="text-center text-2xl font-extrabold text-text-primary">
        Boas-vindas, {firstName}!
      </h1>
      <p className="mt-2 text-center text-sm text-text-secondary">
        Complete seu cadastro em menos de um minuto. Tudo aqui é opcional e dá para mudar depois em Meu perfil.
      </p>

      <form className="mt-6 flex flex-col gap-5" onSubmit={submit} noValidate>
        <div className="flex flex-col items-center gap-3">
          <EditablePhotoAvatar
            src={shownPhoto}
            name={profile.fullName}
            size="2xl"
            upload={async (blob) => onProfileChange(await meApi.uploadPhoto(blob))}
            remove={!providerPhoto && profile.photoUrl ? async () => onProfileChange(await meApi.removePhoto()) : undefined}
          />
          {providerPhoto ? (
            <label className="flex cursor-pointer items-center gap-2" htmlFor="boas-vindas-foto-google">
              <input
                id="boas-vindas-foto-google"
                type="checkbox"
                className="h-4 w-4 rounded border-border-input bg-bg-input text-accent-blue focus:ring-accent-blue"
                checked={keepProviderPhoto}
                onChange={(e) => change({ useProviderPhoto: e.target.checked })}
              />
              <span className="text-sm text-text-primary">Usar a foto da minha conta Google</span>
            </label>
          ) : (
            <p className="text-center text-sm text-text-secondary">
              {profile.photoUrl
                ? 'Toque ou clique na foto para trocar ou remover.'
                : 'Toque ou clique no círculo para pôr uma foto: tire na hora ou escolha uma imagem.'}
            </p>
          )}
        </div>

        <Input
          id="boas-vindas-apelido"
          label="Apelido (opcional)"
          placeholder="Como te chamam na mesa"
          value={value.nickname}
          maxLength={100}
          autoComplete="nickname"
          error={errors.nickname}
          onChange={(e) => change({ nickname: e.target.value })}
        />
        <Input
          id="boas-vindas-whatsapp"
          label="WhatsApp (opcional)"
          type="tel"
          inputMode="tel"
          placeholder="(11) 98765-4321"
          value={formatPhone(value.whatsapp)}
          autoComplete="tel-national"
          error={errors.whatsapp}
          helperText="Com DDD. Guardamos com o 55 do Brasil, para os avisos por WhatsApp."
          onChange={(e) => change({ whatsapp: whatsappInput(e.target.value) })}
        />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onSkip} className="w-full sm:w-auto">
            Fazer depois
          </Button>
          <Button type="submit" className="w-full sm:w-auto">
            Continuar
          </Button>
        </div>
      </form>
    </section>
  )
}

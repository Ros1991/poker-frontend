import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Copy, Mail, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import * as meApi from '../../api/me.api'
import { EditablePhotoAvatar } from '../../components/photo/EditablePhotoAvatar'
import { photoHint } from '../../components/photo/photoHint'
import { Button } from '../../components/ui/Button'
import { FormPageBar } from '../../components/ui/FormTopBar'
import { Input } from '../../components/ui/Input'
import { useAuth } from '../../hooks/useAuth'
import { ROUTES } from '../../constants/routes'
import type { Profile } from '../../types/profile.types'
import { copyToClipboard } from '../../utils/clipboard'
import { errorMessage } from '../../utils/httpErrors'
import { cleanWhatsapp, formatPhone, isValidWhatsapp, whatsappInput } from '../../utils/phone'
import { ProfileSection } from './ProfileSection'
import { PROFILE_QUERY_KEY } from './profileFormat'

interface FormValue {
  fullName: string
  nickname: string
  /** Só os dígitos locais (DDD + número); o servidor grava com o 55 */
  whatsapp: string
}

type FormErrors = Partial<Record<keyof FormValue, string>>

function initialValue(profile: Profile): FormValue {
  return {
    fullName: profile.fullName,
    nickname: profile.nickname ?? '',
    whatsapp: cleanWhatsapp(profile.whatsapp) ?? '',
  }
}

function validate(value: FormValue): FormErrors {
  const errors: FormErrors = {}
  const name = value.fullName.trim()
  if (!name) errors.fullName = 'Informe o nome.'
  else if (name.length > 200) errors.fullName = 'O nome deve ter no máximo 200 caracteres.'
  if (value.nickname.trim().length > 100) errors.nickname = 'O apelido deve ter no máximo 100 caracteres.'
  if (value.whatsapp && !isValidWhatsapp(value.whatsapp)) errors.whatsapp = 'WhatsApp com DDD: 10 ou 11 dígitos.'
  return errors
}

/**
 * Foto e dados da conta (SPEC-20261023-1211): foto pelo mesmo fluxo dos jogadores (câmera/galeria → recorte
 * quadrado do PhotoCropDialog → sempre redonda), nome, apelido e WhatsApp. Ao salvar, o cabeçalho reflete na hora.
 */
export function ProfileDataSection({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient()
  const { updateUser } = useAuth()
  const [value, setValue] = useState<FormValue>(() => initialValue(profile))
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const saved = initialValue(profile)
  const dirty =
    value.fullName.trim() !== saved.fullName.trim() ||
    value.nickname.trim() !== saved.nickname.trim() ||
    value.whatsapp !== saved.whatsapp

  function applyProfile(next: Profile) {
    queryClient.setQueryData(PROFILE_QUERY_KEY, next)
    updateUser({ name: next.fullName, photoUrl: next.photoUrl })
  }

  function change(patch: Partial<FormValue>) {
    setValue((v) => ({ ...v, ...patch }))
    setErrors((e) => {
      const next = { ...e }
      for (const key of Object.keys(patch) as (keyof FormValue)[]) delete next[key]
      return next
    })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const found = validate(value)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    try {
      const next = await meApi.updateProfile({
        fullName: value.fullName.trim(),
        nickname: value.nickname.trim() || null,
        whatsapp: value.whatsapp || null,
      })
      applyProfile(next)
      setValue(initialValue(next))
      toast.success('Dados salvos')
    } catch (err) {
      toast.error(errorMessage(err) ?? 'Não foi possível salvar os dados.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ProfileSection
      id="dados"
      icon={UserRound}
      title="Foto e dados"
      description="Seu nome e sua foto aparecem no cabeçalho e para quem organiza os clubes de que você participa."
    >
      {/* Celular (< sm, SPEC-20261027-2132): barra fixa no topo com X (sai da tela, como fechar), o título e o ✓ (= Salvar
          dados, desabilitado sem alteração como o botão); o botão de baixo some. Do sm para cima, como antes */}
      <FormPageBar
        title="Meu perfil"
        cancelLabel="Fechar"
        onCancel={() => (location.key === 'default' ? navigate(ROUTES.INICIO) : navigate(-1))}
        submit={{ label: 'Salvar dados', form: 'perfil-dados-form', loading: saving, disabled: !dirty || saving }}
      />
      <form id="perfil-dados-form" className="flex flex-col gap-5" onSubmit={(e) => void submit(e)} noValidate>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
          <EditablePhotoAvatar
            src={profile.photoUrl}
            name={profile.fullName}
            size="2xl"
            upload={async (blob) => applyProfile(await meApi.uploadPhoto(blob))}
            remove={profile.photoUrl ? async () => applyProfile(await meApi.removePhoto()) : undefined}
          />
          <p className="text-center text-sm text-text-secondary sm:text-left">
            {photoHint(!!profile.photoUrl)}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              id="perfil-nome"
              label="Nome"
              value={value.fullName}
              maxLength={200}
              autoComplete="name"
              required
              disabled={saving}
              error={errors.fullName}
              onChange={(e) => change({ fullName: e.target.value })}
            />
          </div>
          <Input
            id="perfil-apelido"
            label="Apelido (opcional)"
            placeholder="Como te chamam na mesa"
            value={value.nickname}
            maxLength={100}
            autoComplete="nickname"
            disabled={saving}
            error={errors.nickname}
            onChange={(e) => change({ nickname: e.target.value })}
          />
          <Input
            id="perfil-whatsapp"
            label="WhatsApp (opcional)"
            type="tel"
            inputMode="tel"
            placeholder="(11) 98765-4321"
            value={formatPhone(value.whatsapp)}
            autoComplete="tel-national"
            disabled={saving}
            error={errors.whatsapp}
            helperText="Com DDD. Guardamos com o 55 do Brasil, para os avisos por WhatsApp."
            // Colar "+55 (11) 98765-4321" vira 11987654321 (mesma regra do cadastro de jogadores)
            onChange={(e) => change({ whatsapp: whatsappInput(e.target.value) })}
          />
        </div>

        {/* No celular, o ✓ da barra do topo */}
        <div className="hidden justify-end sm:flex">
          <Button type="submit" loading={saving} disabled={!dirty || saving} className="w-full sm:w-auto">
            Salvar dados
          </Button>
        </div>
      </form>
    </ProfileSection>
  )
}

/** E-mail da conta: só leitura nesta SPEC (trocar e-mail exige reconfirmação — SPEC futura). */
export function ProfileEmailSection({ profile }: { profile: Profile }) {
  async function copy() {
    if (await copyToClipboard(profile.email)) toast.success('E-mail copiado')
    else toast.error('Não foi possível copiar. Selecione o e-mail e copie à mão.')
  }

  return (
    <ProfileSection
      id="email"
      icon={Mail}
      title="E-mail"
      description="É o e-mail com que você entra e recebe os avisos da conta. Para trocar, fale com o suporte."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 break-all rounded-lg border border-border-default bg-bg-secondary px-3 py-2.5 text-sm font-medium text-text-primary">
          {profile.email}
        </p>
        {profile.emailIsPrivateRelay && (
          <Button type="button" variant="secondary" onClick={() => void copy()} className="w-full sm:w-auto">
            <Copy className="h-4 w-4" aria-hidden="true" /> Copiar
          </Button>
        )}
      </div>
      {profile.emailIsPrivateRelay && (
        <p className="mt-2 text-sm text-text-secondary">
          Este é o e-mail oculto da Apple. Passe este e-mail ao organizador para ele achar a sua conta.
        </p>
      )}
    </ProfileSection>
  )
}

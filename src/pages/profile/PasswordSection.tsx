import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { KeyRound, MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import * as meApi from '../../api/me.api'
import { Button } from '../../components/ui/Button'
import { PasswordInput } from '../../components/ui/PasswordInput'
import type { Profile } from '../../types/profile.types'
import { errorMessage, errorStatus } from '../../utils/httpErrors'
import { ProfileSection } from './ProfileSection'
import { SESSIONS_QUERY_KEY } from './profileFormat'

type Errors = Partial<Record<'currentPassword' | 'newPassword' | 'confirmPassword', string>>

/**
 * Senha (SPEC-20261023-1211). Com senha: "Trocar senha" pede a atual; este aparelho continua e os outros saem.
 * Conta que só entra pelo Google: "Definir senha" manda o link por e-mail (o mesmo link de uso único do "Esqueci
 * minha senha").
 */
export function PasswordSection({ profile }: { profile: Profile }) {
  return profile.hasPassword ? <ChangePasswordForm email={profile.email} /> : <SetupPasswordLink email={profile.email} />
}

function ChangePasswordForm({ email }: { email: string }) {
  const queryClient = useQueryClient()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const found: Errors = {}
    if (!currentPassword) found.currentPassword = 'Informe a senha atual.'
    if (newPassword.length < 6) found.newPassword = 'A nova senha deve ter pelo menos 6 caracteres.'
    else if (newPassword === currentPassword) found.newPassword = 'A nova senha precisa ser diferente da atual.'
    if (!found.newPassword && confirmPassword !== newPassword) found.confirmPassword = 'As senhas não conferem.'
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    try {
      const result = await meApi.changePassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success(result.message || 'Senha trocada.')
      void queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY })
    } catch (err) {
      const message = errorMessage(err)
      if (errorStatus(err) === 400 && message === 'Senha atual incorreta.') setErrors({ currentPassword: message })
      else toast.error(message ?? 'Não foi possível trocar a senha.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ProfileSection
      id="senha"
      icon={KeyRound}
      title="Senha"
      description="Ao trocar a senha, os outros aparelhos saem da sua conta. Este continua conectado."
    >
      <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)} noValidate>
        {/* Campo de usuário escondido: o gerenciador de senhas do navegador sabe de qual conta é a senha */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <div className="grid gap-4 sm:grid-cols-3">
          <PasswordInput
            id="perfil-senha-atual"
            label="Senha atual"
            value={currentPassword}
            autoComplete="current-password"
            disabled={saving}
            error={errors.currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value)
              setErrors((x) => ({ ...x, currentPassword: undefined }))
            }}
          />
          <PasswordInput
            id="perfil-senha-nova"
            label="Nova senha"
            value={newPassword}
            autoComplete="new-password"
            disabled={saving}
            error={errors.newPassword}
            helperText="Pelo menos 6 caracteres."
            onChange={(e) => {
              setNewPassword(e.target.value)
              setErrors((x) => ({ ...x, newPassword: undefined }))
            }}
          />
          <PasswordInput
            id="perfil-senha-confirma"
            label="Confirmar nova senha"
            value={confirmPassword}
            autoComplete="new-password"
            disabled={saving}
            error={errors.confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              setErrors((x) => ({ ...x, confirmPassword: undefined }))
            }}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={saving} className="w-full sm:w-auto">
            Trocar senha
          </Button>
        </div>
      </form>
    </ProfileSection>
  )
}

function SetupPasswordLink({ email }: { email: string }) {
  const [sending, setSending] = useState(false)
  const [sentMessage, setSentMessage] = useState<string | null>(null)

  async function send() {
    setSending(true)
    try {
      const result = await meApi.requestPasswordSetupLink()
      setSentMessage(result.message)
      toast.success('Link enviado')
    } catch (err) {
      toast.error(errorMessage(err) ?? 'Não foi possível enviar o link.')
    } finally {
      setSending(false)
    }
  }

  return (
    <ProfileSection
      id="senha"
      icon={KeyRound}
      title="Senha"
      description="Sua conta entra só com o Google. Defina uma senha para entrar também com e-mail e senha."
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-text-secondary">
          Mandamos um link para <strong className="font-semibold text-text-primary break-all">{email}</strong>. Ele vale
          por 1 hora; depois de criar a senha, entre de novo nos seus aparelhos.
        </p>
        {sentMessage && (
          <p
            className="flex items-start gap-2 rounded-lg border border-accent-green/40 bg-accent-green-soft p-3 text-sm text-text-primary"
            role="status"
          >
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-green-deep" aria-hidden="true" />
            <span>{sentMessage}</span>
          </p>
        )}
        <div className="flex justify-end">
          <Button type="button" onClick={() => void send()} loading={sending} className="w-full sm:w-auto">
            {sentMessage ? 'Enviar outro link' : 'Enviar link para definir senha'}
          </Button>
        </div>
      </div>
    </ProfileSection>
  )
}

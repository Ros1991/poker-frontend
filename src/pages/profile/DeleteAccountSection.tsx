import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import * as meApi from '../../api/me.api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../hooks/useAuth'
import { DELETE_CONFIRMATION_WORD } from '../../types/profile.types'
import type { ExternalLogins, Profile } from '../../types/profile.types'
import { errorMessage } from '../../utils/httpErrors'
import { ProfileGoogleButton } from './ProfileGoogleButton'
import { ProfileSection } from './ProfileSection'

interface DeleteAccountSectionProps {
  profile: Profile
  logins: ExternalLogins | undefined
}

// SPEC-20261029-1723: só os home games ALÉM do da conta (a Liga cria até 2) bloqueiam — o da conta sai junto
function ownerMessage(count: number) {
  return count === 1
    ? 'Você é dono de 1 home game além do da sua conta. Exclua-o antes ou fale com o suporte para transferir.'
    : `Você é dono de ${count} home games além do da sua conta. Exclua-os antes ou fale com o suporte para transferir.`
}

/**
 * Excluir conta (SPEC-20261023-1211), no fim da página. Bloqueado para dono de home game além do principal da conta
 * (`profile.ownedHomeGames` só conta esses — SPEC-20261029-1723). A confirmação pede "EXCLUIR" e a senha — ou, em conta
 * sem senha, entrar com o Google de novo na hora. A conta é anonimizada (nome, apelido, WhatsApp e foto apagados,
 * e-mail liberado), todos os aparelhos saem e o clube da conta (o home game principal: torneios, jogadores e rankings
 * dele) é excluído junto; os home games de outras pessoas ficam.
 */
export function DeleteAccountSection({ profile, logins }: DeleteAccountSectionProps) {
  const [open, setOpen] = useState(false)
  const blocked = profile.ownedHomeGames > 0
  const isAdmin = profile.role === 'Admin'

  return (
    <ProfileSection
      id="excluir-conta"
      icon={Trash2}
      title="Excluir conta"
      danger
      description="Apaga seus dados de conta e tira você de todos os aparelhos. Não dá para desfazer."
    >
      <div className="flex flex-col gap-3">
        <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
          <li>Nome, apelido, WhatsApp e foto são apagados e o e-mail fica livre para um cadastro novo.</li>
          <li>O clube da sua conta é excluído junto: torneios, jogadores, estruturas e rankings dele.</li>
          <li>Você sai dos clubes de outras pessoas de que participa como membro; os jogadores e o histórico deles continuam com os organizadores.</li>
        </ul>
        {blocked && (
          <p className="rounded-lg border border-accent-yellow/40 bg-accent-yellow-soft p-3 text-sm text-text-primary" role="note">
            {ownerMessage(profile.ownedHomeGames)}
          </p>
        )}
        {isAdmin && !blocked && (
          <p className="rounded-lg border border-accent-yellow/40 bg-accent-yellow-soft p-3 text-sm text-text-primary" role="note">
            Conta de administrador do sistema não pode ser excluída por aqui. Fale com o suporte.
          </p>
        )}
        <div className="flex justify-end">
          <Button
            variant="danger"
            onClick={() => setOpen(true)}
            disabled={blocked || isAdmin}
            className="w-full sm:w-auto"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir minha conta
          </Button>
        </div>
      </div>

      {open && <DeleteAccountModal profile={profile} logins={logins} onClose={() => setOpen(false)} />}
    </ProfileSection>
  )
}

function DeleteAccountModal({
  profile,
  logins,
  onClose,
}: {
  profile: Profile
  logins: ExternalLogins | undefined
  onClose: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { clearSession } = useAuth()
  const [confirmation, setConfirmation] = useState('')
  const [password, setPassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmed = confirmation.trim().toUpperCase() === DELETE_CONFIRMATION_WORD
  const google = logins?.providers.find((p) => p.provider === 'google' && p.connected && p.enabled && p.clientId)

  async function remove(extra: { password?: string; idToken?: string; nonce?: string }) {
    setDeleting(true)
    setError(null)
    try {
      await meApi.deleteAccount({ confirmation: confirmation.trim(), ...extra })
      // O servidor já derrubou todas as sessões: só limpa este aparelho
      clearSession()
      queryClient.clear()
      toast.success('Sua conta foi excluída.')
      navigate(ROUTES.LOGIN, { replace: true })
    } catch (err) {
      setError(errorMessage(err) ?? 'Não foi possível excluir a conta. Tente de novo.')
      setDeleting(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!confirmed) {
      setError(`Digite ${DELETE_CONFIRMATION_WORD} para confirmar.`)
      return
    }
    if (!password) {
      setError('Informe a sua senha.')
      return
    }
    void remove({ password })
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Excluir minha conta"
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={deleting}>
            Cancelar
          </Button>
          {profile.hasPassword && (
            <Button
              variant="danger"
              type="submit"
              form="excluir-conta-form"
              loading={deleting}
              disabled={!confirmed || !password || deleting}
            >
              Excluir conta
            </Button>
          )}
        </div>
      }
    >
      <form id="excluir-conta-form" className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <p className="text-sm text-text-secondary">
          Esta ação não pode ser desfeita. Para confirmar, digite{' '}
          <strong className="font-bold text-text-primary">{DELETE_CONFIRMATION_WORD}</strong> e{' '}
          {profile.hasPassword ? 'a sua senha.' : 'entre com o Google de novo.'}
        </p>
        {/* Usuário escondido: o gerenciador de senhas sabe de qual conta é a senha */}
        <input type="email" name="username" autoComplete="username" value={profile.email} readOnly hidden />
        <Input
          id="excluir-confirmacao"
          label={`Digite ${DELETE_CONFIRMATION_WORD}`}
          value={confirmation}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={deleting}
          onChange={(e) => {
            setConfirmation(e.target.value)
            setError(null)
          }}
        />
        {profile.hasPassword ? (
          <PasswordInput
            id="excluir-senha"
            label="Sua senha"
            value={password}
            autoComplete="current-password"
            disabled={deleting}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
          />
        ) : google?.clientId ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-text-secondary">Confirme entrando com o Google</p>
            {confirmed ? (
              <ProfileGoogleButton
                clientId={google.clientId}
                onCredential={(idToken, nonce) => remove({ idToken, nonce })}
                busy={deleting}
                busyText="Excluindo a conta…"
              />
            ) : (
              <p className="rounded-lg border border-border-default bg-bg-secondary p-3 text-sm text-text-secondary">
                Digite {DELETE_CONFIRMATION_WORD} acima para liberar o botão do Google.
              </p>
            )}
          </div>
        ) : (
          <p className="rounded-lg border border-accent-yellow/40 bg-accent-yellow-soft p-3 text-sm text-text-primary" role="note">
            Sua conta não tem senha nem Google disponível agora. Defina uma senha em "Senha" e volte aqui.
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-accent-red/40 bg-accent-red-soft p-3 text-sm text-accent-red-deep" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}

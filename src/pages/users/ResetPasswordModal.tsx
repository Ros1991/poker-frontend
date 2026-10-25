import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Copy, KeyRound, Mail, MessageCircle, RefreshCw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import * as usersApi from '../../api/users.api'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { PasswordInput } from '../../components/ui/PasswordInput'
import type {
  AdminResetPasswordMode,
  AdminResetPasswordResponse,
  AdminUserDetail,
} from '../../types/user.types'
import { maskEmail } from '../../utils/authEmailStorage'
import { copyToClipboard } from '../../utils/clipboard'
import { errorMessage, errorStatus } from '../../utils/httpErrors'
import { cn } from '../../utils/cn'
import {
  adminUserQueryKey,
  formatDayTime,
  generateTemporaryPassword,
  whatsappDigits,
} from './adminUserFormat'

interface ResetPasswordModalProps {
  isOpen: boolean
  onClose: () => void
  user: AdminUserDetail
}

interface ModeOption {
  mode: AdminResetPasswordMode
  icon: LucideIcon
  title: string
  description: string
}

/**
 * "Redefinir senha" da ficha (SPEC-20261023-1206), em três modos: senha temporária (com o olhinho, "Gerar" e
 * "Copiar"; todas as sessões da pessoa caem), e-mail de redefinição (desabilitado com explicação quando o servidor não
 * envia e-mail — 409) e link de 24 h para WhatsApp ("Copiar" e "Abrir WhatsApp" com a mensagem pronta; sem número,
 * só copiar). Fecha só no X/Fechar.
 */
export function ResetPasswordModal({ isOpen, onClose, user }: ResetPasswordModalProps) {
  if (!isOpen) return null
  return <ResetPasswordContent onClose={onClose} user={user} />
}

function ResetPasswordContent({ onClose, user }: Omit<ResetPasswordModalProps, 'isOpen'>) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<AdminResetPasswordMode>('Temporary')
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [emailBlocked, setEmailBlocked] = useState(!user.emailDeliveryEnabled)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<AdminResetPasswordResponse | null>(null)

  const firstName = user.fullName.trim().split(/\s+/)[0] || user.fullName
  const masked = maskEmail(user.email)

  const options: ModeOption[] = [
    {
      mode: 'Temporary',
      icon: KeyRound,
      title: 'Senha temporária',
      description: 'Você define a senha e passa para a pessoa. Todas as sessões da conta são encerradas.',
    },
    {
      mode: 'Email',
      icon: Mail,
      title: 'Enviar e-mail de redefinição',
      description: emailBlocked
        ? 'Indisponível: o servidor não está enviando e-mails agora. Use a senha temporária ou o link.'
        : `Link de uso único (vale 1 hora) para ${masked}.`,
    },
    {
      mode: 'Link',
      icon: MessageCircle,
      title: 'Link para WhatsApp',
      description: 'Link de uso único que vale 24 horas. Gerar outro invalida o anterior.',
    },
  ]

  function choose(next: AdminResetPasswordMode) {
    if (next === 'Email' && emailBlocked) return
    setMode(next)
    setResult(null)
  }

  async function submit() {
    if (mode === 'Temporary') {
      if (password.length < 6) {
        setPasswordError('A senha temporária deve ter pelo menos 6 caracteres.')
        return
      }
      setPasswordError(null)
    }
    setPending(true)
    try {
      const response = await usersApi.resetPassword(user.id, {
        mode,
        password: mode === 'Temporary' ? password : undefined,
      })
      setResult(response)
      await queryClient.invalidateQueries({ queryKey: adminUserQueryKey(user.id) })
      if (mode === 'Temporary') toast.success('Senha temporária definida. As sessões da pessoa foram encerradas.')
      else if (mode === 'Email') toast.success(`E-mail de redefinição enviado para ${response.sentTo ?? masked}.`)
      else toast.success('Link de redefinição gerado.')
    } catch (err) {
      if (mode === 'Email' && errorStatus(err) === 409) {
        setEmailBlocked(true)
        setMode('Temporary')
      }
      toast.error(errorMessage(err) ?? 'Não foi possível redefinir a senha.')
    } finally {
      setPending(false)
    }
  }

  async function copy(text: string, label: string) {
    const ok = await copyToClipboard(text)
    if (ok) toast.success(`${label} copiado!`)
    else toast.error('Não foi possível copiar. Selecione e copie à mão.')
  }

  const linkMessage = result?.resetUrl
    ? `Olá, ${firstName}! Para criar uma nova senha, abra este link (vale por 24 horas e só pode ser usado uma vez): ${result.resetUrl}`
    : ''
  const phone = whatsappDigits(result?.whatsapp ?? user.whatsapp)
  const whatsappUrl = phone && linkMessage ? `https://wa.me/${phone}?text=${encodeURIComponent(linkMessage)}` : null

  const done = result !== null && result.mode === mode
  const actionLabel =
    mode === 'Temporary' ? 'Definir senha temporária' : mode === 'Email' ? 'Enviar e-mail' : done ? 'Gerar outro link' : 'Gerar link'

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Redefinir senha"
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Fechar
          </Button>
          {!(done && mode !== 'Link') && (
            <Button onClick={() => void submit()} loading={pending}>
              {actionLabel}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-text-secondary">
          Conta de <span className="font-semibold text-text-primary">{user.fullName}</span> ({user.email}).
        </p>

        <div role="radiogroup" aria-label="Como redefinir" className="flex flex-col gap-2">
          {options.map((option) => {
            const selected = mode === option.mode
            const disabled = option.mode === 'Email' && emailBlocked
            const Icon = option.icon
            return (
              <button
                key={option.mode}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-disabled={disabled}
                disabled={disabled}
                onClick={() => choose(option.mode)}
                className={cn(
                  'flex min-h-[56px] items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors',
                  selected ? 'border-accent-blue bg-accent-blue-soft' : 'border-border-input bg-bg-card',
                  disabled ? 'cursor-not-allowed bg-bg-tertiary' : !selected && 'hover:bg-bg-tertiary',
                )}
              >
                <Icon
                  className={cn('mt-0.5 h-5 w-5 shrink-0', selected ? 'text-accent-blue' : 'text-text-muted')}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block font-semibold text-text-primary">{option.title}</span>
                  <span className="block text-sm text-text-secondary">{option.description}</span>
                </span>
              </button>
            )
          })}
        </div>

        {mode === 'Temporary' && (
          <div className="flex flex-col gap-3">
            <PasswordInput
              id="senha-temporaria"
              label="Senha temporária"
              autoComplete="new-password"
              placeholder="Mínimo de 6 caracteres"
              value={password}
              disabled={done}
              error={passwordError ?? undefined}
              onChange={(e) => {
                setPassword(e.target.value)
                setPasswordError(null)
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={done}
                onClick={() => {
                  setPassword(generateTemporaryPassword())
                  setPasswordError(null)
                }}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Gerar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!password}
                onClick={() => void copy(password, 'Senha')}
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copiar
              </Button>
            </div>
            <Notice>
              Todas as sessões de {firstName} serão encerradas: será preciso entrar de novo com esta senha
              {user.hasPassword ? '' : ' (a conta, que hoje só entra pelo Google, passa a ter senha também)'}.
            </Notice>
            {!user.emailConfirmedAt && (
              <Notice>
                O e-mail desta conta ainda não foi confirmado. Use "Confirmar manualmente" na ficha para a pessoa
                conseguir entrar.
              </Notice>
            )}
            {done && (
              <Success>Senha temporária definida. Passe a senha para {firstName} por um canal seguro.</Success>
            )}
          </div>
        )}

        {mode === 'Email' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-secondary">
              Vamos enviar o link de redefinição para <span className="font-semibold text-text-primary">{masked}</span>.
              Se o e-mail estiver errado, use o link para WhatsApp.
            </p>
            {done && <Success>E-mail enviado para {result?.sentTo ?? masked}.</Success>}
          </div>
        )}

        {mode === 'Link' && (
          <div className="flex flex-col gap-3">
            {!done && (
              <p className="text-sm text-text-secondary">
                O link abre a página &quot;Criar nova senha&quot;. Ele vale 24 horas e só pode ser usado uma vez.
              </p>
            )}
            {done && result?.resetUrl && (
              <>
                <Input id="link-redefinicao" label="Link de redefinição" value={result.resetUrl} readOnly onFocus={(e) => e.target.select()} />
                {result.expiresAt && (
                  <p className="text-xs text-text-secondary">Vale até {formatDayTime(result.expiresAt)}.</p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="secondary" onClick={() => void copy(result.resetUrl!, 'Link')}>
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Copiar link
                  </Button>
                  {whatsappUrl ? (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-accent-green-deep px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-green-hover"
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      Abrir WhatsApp
                    </a>
                  ) : (
                    <p className="self-center text-sm text-text-secondary">
                      A conta não tem WhatsApp cadastrado: copie o link e mande por onde preferir.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-accent-yellow-soft px-3 py-2 text-sm text-text-primary">{children}</p>
  )
}

function Success({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-accent-green-soft px-3 py-2 text-sm text-accent-green-deep">
      <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

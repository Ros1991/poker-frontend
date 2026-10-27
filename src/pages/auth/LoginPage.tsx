import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, MailWarning } from 'lucide-react'
import { BrandLogo } from '../../components/brand/BrandLogo'
import { toast } from 'sonner'
import { Input } from '../../components/ui/Input'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { ROUTES } from '../../constants/routes'
import * as authApi from '../../api/auth.api'
import { EMAIL_NOT_CONFIRMED_CODE } from '../../types/auth.types'
import { errorCode, errorMessage, errorStatus } from '../../utils/httpErrors'
import { GoogleSignInSection } from '../../components/auth/GoogleSignInSection'
import { LinkGoogleForm } from '../../components/auth/LinkGoogleForm'
import { useGoogleSignIn } from '../../components/auth/useGoogleSignIn'
import type { ForgotPasswordState } from '../../utils/authEmailStorage'

const loginSchema = z.object({
  email: z.email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
  rememberMe: z.boolean().optional(),
})

type LoginFormData = z.infer<typeof loginSchema>

const REMEMBERED_EMAIL_KEY = 'poker_remembered_email'
// Último e-mail usado no cadastro/confirmação: preenche o campo sem marcar "Lembrar e-mail e senha"
const LAST_EMAIL_KEY = 'poker_last_email'
const REMEMBERED_PASSWORD_KEY = 'poker_remembered_password'

/** Espera entre reenvios do link de confirmação: igual ao cooldown de 2 min do backend (D16.2). */
const RESEND_COOLDOWN_SECONDS = 120

// Ofuscação leve (não é segurança — apenas evita senha em texto puro no localStorage).
function encode(value: string): string {
  try {
    return btoa(encodeURIComponent(value))
  } catch {
    return ''
  }
}
function decode(value: string | null): string {
  if (!value) return ''
  try {
    return decodeURIComponent(atob(value))
  } catch {
    return ''
  }
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Valores iniciais do formulário. O e-mail do último cadastro/confirmação neste navegador (poker_last_email) é mais
 * novo que o "Lembrar e-mail e senha": se for de OUTRA conta (ex.: o celular do organizador usado para cadastrar um
 * amigo), o login abre com ele, sem senha e com "Lembrar" desmarcado — nunca com a senha de outra conta pronta para
 * entrar. Sem cadastro novo (ou com o mesmo e-mail), vale o "Lembrar" de sempre.
 */
function readLoginDefaults(): LoginFormData {
  const rememberedEmail = readStorage(REMEMBERED_EMAIL_KEY)
  const lastEmail = readStorage(LAST_EMAIL_KEY)
  if (lastEmail && (!rememberedEmail || !sameEmail(lastEmail, rememberedEmail)))
    return { email: lastEmail, password: '', rememberMe: false }
  return {
    email: rememberedEmail ?? '',
    password: rememberedEmail ? decode(readStorage(REMEMBERED_PASSWORD_KEY)) : '',
    rememberMe: !!rememberedEmail,
  }
}

/** Login com a senha certa, mas o e-mail ainda não foi confirmado (403 email_not_confirmed). */
interface NotConfirmedState {
  /** E-mail digitado na tentativa que deu 403: é para ele que o link é reenviado */
  email: string
  /** Mensagem do backend, com o e-mail mascarado */
  message: string
}

type ResendStatus = 'idle' | 'sending' | 'sent' | 'rateLimited' | 'error'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isLoading, setIsLoading] = useState(false)
  const [notConfirmed, setNotConfirmed] = useState<NotConfirmedState | null>(null)
  const [resendStatus, setResendStatus] = useState<ResendStatus>('idle')
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0)

  // Volta para onde a pessoa estava (ex.: o QR da TV abriu /parear/CODIGO)
  const from = (location.state as { from?: Location } | null)?.from
  const returnTo = from ? `${from.pathname}${from.search}` : ROUTES.HOME
  // Login com Google (SPEC-20261023-1210): mesmo retorno do login por senha
  const google = useGoogleSignIn(returnTo)

  const [defaults] = useState(readLoginDefaults)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: defaults,
  })
  // "Esqueci minha senha" leva o e-mail que está no campo (não o do "Lembrar", que pode ser de outra conta)
  const typedEmail = useWatch({ control, name: 'email' })
  const forgotState: ForgotPasswordState | undefined = typedEmail?.trim() ? { email: typedEmail.trim() } : undefined

  // Contagem regressiva do "Reenviar e-mail de confirmação"
  useEffect(() => {
    if (resendSecondsLeft <= 0) return
    const id = window.setTimeout(() => setResendSecondsLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [resendSecondsLeft])

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true)
    setNotConfirmed(null)
    setResendStatus('idle')
    setResendSecondsLeft(0)
    try {
      if (data.rememberMe) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, data.email)
        localStorage.setItem(REMEMBERED_PASSWORD_KEY, encode(data.password))
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY)
        localStorage.removeItem(REMEMBERED_PASSWORD_KEY)
      }
      await login(data)
      // Entrou: o e-mail do último cadastro já cumpriu o papel (senão voltaria a passar na frente do "Lembrar")
      try {
        localStorage.removeItem(LAST_EMAIL_KEY)
      } catch {
        // navegador sem armazenamento: nada a limpar
      }
      navigate(returnTo, { replace: true })
    } catch (err) {
      if (errorStatus(err) === 403 && errorCode(err) === EMAIL_NOT_CONFIRMED_CODE) {
        setNotConfirmed({
          email: data.email.trim(),
          message:
            errorMessage(err) ??
            'Confirme seu e-mail antes de entrar. Enviamos um link para o e-mail da conta.',
        })
      } else if (errorStatus(err) === 429) {
        // Senha errada demais (POST auth/login): o backend diz quanto esperar
        toast.error(
          errorMessage(err) ?? 'Muitas tentativas com senha errada. Espere alguns minutos e tente de novo.',
        )
      } else {
        toast.error('E-mail ou senha incorretos.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResendConfirmation() {
    if (!notConfirmed) return
    setResendStatus('sending')
    try {
      await authApi.resendConfirmation(notConfirmed.email)
      setResendStatus('sent')
      setResendSecondsLeft(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      if (errorStatus(err) === 429) {
        setResendStatus('rateLimited')
        setResendSecondsLeft(RESEND_COOLDOWN_SECONDS)
      } else {
        setResendStatus('error')
      }
    }
  }

  const resendWaiting = resendSecondsLeft > 0

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <BrandLogo variant="full" decorative className="h-36" />
          <h1 className="sr-only">Poker da Galera</h1>
        </div>

        {google.linkRequired ? (
          <LinkGoogleForm
            email={google.linkRequired.email}
            ticket={google.linkRequired.ticket}
            returnTo={returnTo}
            onCancel={google.cancelLink}
          />
        ) : (
          <div className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-secondary p-6">
            <GoogleSignInSection
              context="signin"
              dividerText="ou entre com seu e-mail"
              onCredential={google.handleCredential}
              busy={google.busy}
              error={google.error}
            />

            <form
              onSubmit={(e) => void handleSubmit(onSubmit)(e)}
              className="flex flex-col gap-4"
            >
              <Input
                label="E-mail"
                type="email"
                placeholder="seu@email.com"
                error={errors.email?.message}
                autoComplete="email"
                {...register('email')}
              />

              <PasswordInput
                label="Senha"
                placeholder="Sua senha"
                error={errors.password?.message}
                autoComplete="current-password"
                {...register('password')}
              />

              {/* Celular (SPEC-20261026-2103): "Lembrar" numa linha e "Esqueci minha senha" na de baixo; do sm em diante
                  lado a lado quando cabe. Os dois textos nunca quebram (sem espaço, a linha inteira desce). */}
              <div
                className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3 sm:gap-y-1"
                data-login-options
              >
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2" data-login-remember>
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 rounded border-border-input bg-bg-input text-accent-blue focus:ring-accent-blue"
                    {...register('rememberMe')}
                  />
                  <span className="whitespace-nowrap text-sm text-text-secondary">
                    Lembrar e-mail e senha
                  </span>
                </label>
                <Link
                  to={ROUTES.FORGOT_PASSWORD}
                  state={forgotState}
                  className="inline-flex min-h-[44px] items-center whitespace-nowrap text-sm text-accent-blue hover:underline"
                  data-login-forgot
                >
                  Esqueci minha senha
                </Link>
              </div>

              {notConfirmed && (
                <div className="flex flex-col gap-3 rounded-lg border border-accent-yellow/40 bg-accent-yellow-soft p-3">
                  <p className="flex items-start gap-2 text-sm text-text-primary" role="alert">
                    <MailWarning
                      className="mt-0.5 h-4 w-4 shrink-0 text-accent-yellow"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 break-words">{notConfirmed.message}</span>
                  </p>

                  {resendStatus === 'sent' && (
                    <p
                      className="flex items-start gap-2 text-sm font-medium text-text-primary"
                      role="status"
                    >
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-accent-green"
                        aria-hidden="true"
                      />
                      Se o e-mail estiver cadastrado, reenviamos o link.
                    </p>
                  )}
                  {resendStatus === 'rateLimited' && (
                    <p className="text-sm text-accent-red-deep" role="alert">
                      Muitas tentativas seguidas. Espere um minuto.
                    </p>
                  )}
                  {resendStatus === 'error' && (
                    <p className="text-sm text-accent-red-deep" role="alert">
                      Não deu para reenviar agora. Tente de novo em instantes.
                    </p>
                  )}

                  {/* px-2: o rótulo cabe numa linha no celular de 375 px (o botão herda 16 px) */}
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full px-2"
                    loading={resendStatus === 'sending'}
                    disabled={resendStatus === 'sending' || resendWaiting}
                    onClick={() => void handleResendConfirmation()}
                  >
                    Reenviar e-mail de confirmação
                  </Button>
                  {resendWaiting && (
                    <p className="text-center text-xs text-text-primary tabular-nums">
                      Dá para reenviar de novo em {Math.floor(resendSecondsLeft / 60)}:{String(resendSecondsLeft % 60).padStart(2, '0')}.
                    </p>
                  )}
                </div>
              )}

              <Button type="submit" loading={isLoading} className="mt-2">
                Entrar
              </Button>

              <p className="text-center text-sm text-text-secondary">
                Não tem uma conta?{' '}
                <Link
                  to={ROUTES.REGISTER}
                  state={from ? { from } : undefined}
                  className="font-medium text-accent-blue hover:underline"
                >
                  Criar conta
                </Link>
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

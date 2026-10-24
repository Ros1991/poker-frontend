import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { BrandLogo } from '../../components/brand/BrandLogo'
import { toast } from 'sonner'
import { Input } from '../../components/ui/Input'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { Button } from '../../components/ui/Button'
import { ROUTES } from '../../constants/routes'
import * as authApi from '../../api/auth.api'
import { errorMessage, errorStatus } from '../../utils/httpErrors'
import { GoogleSignInSection } from '../../components/auth/GoogleSignInSection'
import { LinkGoogleForm } from '../../components/auth/LinkGoogleForm'
import { useGoogleSignIn } from '../../components/auth/useGoogleSignIn'

const registerSchema = z
  .object({
    fullName: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
    nickname: z.string().optional(),
    email: z.email('E-mail inválido'),
    whatsapp: z.string().optional(),
    password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
    confirmPassword: z.string().min(1, 'Confirme sua senha'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Senhas não conferem',
    path: ['confirmPassword'],
  })

type RegisterFormData = z.infer<typeof registerSchema>

/** Mesma chave do LoginPage: o login já abre com o e-mail do cadastro preenchido. */
// Último e-mail usado: só preenche o login/confirmação; NÃO liga o "Lembrar e-mail e senha" (esse é poker_remembered_email)
const LAST_EMAIL_KEY = 'poker_last_email'

/** Espera antes de liberar "Reenviar e-mail": igual ao cooldown de 2 min do backend (D16.2). */
const RESEND_COOLDOWN_SECONDS = 120

const RATE_LIMIT_MESSAGE = 'Muitas tentativas seguidas. Espere um minuto.'

/** Mensagem do 400 do cadastro quando o e-mail já tem conta (inclusive conta que só entra pelo Google). */
const EMAIL_IN_USE_MESSAGE = 'E-mail já está em uso.'

function rememberEmail(email: string) {
  try {
    localStorage.setItem(LAST_EMAIL_KEY, email)
  } catch {
    // Navegador sem armazenamento (aba anônima bloqueada): o login só não vem preenchido
  }
}

/**
 * Cadastro (SPEC-20261023-1209): a conta nasce sem sessão e só entra depois de confirmar o
 * e-mail. Depois do 202 a tela vira "Confira seu e-mail", com reenvio do link.
 */
export function RegisterPage() {
  const location = useLocation()
  // Volta para onde a pessoa estava (ex.: o QR da TV abriu /parear/CODIGO e passou pelo login)
  const from = (location.state as { from?: Location } | null)?.from
  const returnTo = from ? `${from.pathname}${from.search}` : ROUTES.HOME
  // Criar conta com o Google (SPEC-20261023-1210): conta nova já nasce confirmada e entra direto
  const google = useGoogleSignIn(returnTo)
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState<{
    text: string
    /** 400 (ex.: e-mail já em uso): oferece o "Esqueci minha senha" */
    offerReset: boolean
  } | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  async function onSubmit(data: RegisterFormData) {
    setIsLoading(true)
    setServerError(null)
    const email = data.email.trim()
    try {
      const response = await authApi.register({
        fullName: data.fullName,
        nickname: data.nickname,
        email,
        password: data.password,
        whatsapp: data.whatsapp,
      })
      const confirmedEmail = response.email || email
      rememberEmail(confirmedEmail)
      setSentTo(confirmedEmail)
    } catch (err) {
      const status = errorStatus(err)
      if (status === 429) {
        setServerError({ text: RATE_LIMIT_MESSAGE, offerReset: false })
      } else if (status === 400) {
        // Ex.: "E-mail já está em uso." (conta já confirmada com este e-mail)
        setServerError({
          text: errorMessage(err) ?? 'Não deu para criar a conta. Verifique os dados.',
          offerReset: true,
        })
      } else {
        toast.error('Não deu para criar a conta. Tente de novo em instantes.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <BrandLogo variant="full" decorative className="h-36" />
          <h1 className="sr-only">Poker da Galera</h1>
          <p className="text-sm text-text-secondary">Criar nova conta</p>
        </div>

        {sentTo ? (
          <CheckEmailCard email={sentTo} />
        ) : google.linkRequired ? (
          <LinkGoogleForm
            email={google.linkRequired.email}
            ticket={google.linkRequired.ticket}
            returnTo={returnTo}
            onCancel={google.cancelLink}
          />
        ) : (
          <div className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-secondary p-6">
            <GoogleSignInSection
              context="signup"
              dividerText="ou cadastre-se com seu e-mail"
              onCredential={google.handleCredential}
              busy={google.busy}
              error={google.error}
            />

            <form
              onSubmit={(e) => void handleSubmit(onSubmit)(e)}
              className="flex flex-col gap-4"
            >
              <Input
                label="Nome completo"
                type="text"
                placeholder="Seu nome"
                error={errors.fullName?.message}
                autoComplete="name"
                {...register('fullName')}
              />

              <Input
                label="Apelido (opcional)"
                type="text"
                placeholder="Seu apelido na mesa"
                error={errors.nickname?.message}
                {...register('nickname')}
              />

              <Input
                label="E-mail"
                type="email"
                placeholder="seu@email.com"
                error={errors.email?.message}
                autoComplete="email"
                helperText="Vamos mandar um link para confirmar este e-mail."
                {...register('email')}
              />

              <Input
                label="WhatsApp (opcional)"
                type="tel"
                placeholder="+55 11 99999-9999"
                error={errors.whatsapp?.message}
                autoComplete="tel"
                {...register('whatsapp')}
              />

              <PasswordInput
                label="Senha"
                placeholder="Mínimo 6 caracteres"
                error={errors.password?.message}
                autoComplete="new-password"
                {...register('password')}
              />

              <PasswordInput
                label="Confirmar senha"
                placeholder="Repita sua senha"
                error={errors.confirmPassword?.message}
                autoComplete="new-password"
                {...register('confirmPassword')}
              />

              {serverError && (
                <div
                  className="flex flex-col gap-1 rounded-lg border border-accent-red/40 bg-accent-red-soft p-3"
                  role="alert"
                >
                  <p className="text-sm text-accent-red-deep">{serverError.text}</p>
                  {/* Dica neutra (vale para toda conta existente, não revela se ela usa o Google) */}
                  {serverError.text === EMAIL_IN_USE_MESSAGE && (
                    <p className="text-sm text-text-secondary">
                      Entre com o Google ou use Esqueci minha senha.
                    </p>
                  )}
                  {serverError.offerReset && (
                    <Link
                      to={ROUTES.FORGOT_PASSWORD}
                      className="text-sm font-medium text-accent-blue hover:underline"
                    >
                      Esqueci minha senha
                    </Link>
                  )}
                </div>
              )}

              <Button type="submit" loading={isLoading} className="mt-2">
                Criar conta
              </Button>

              <p className="text-center text-sm text-text-secondary">
                Já tem uma conta?{' '}
                <Link
                  to={ROUTES.LOGIN}
                  state={from ? { from } : undefined}
                  className="font-medium text-accent-blue hover:underline"
                >
                  Fazer login
                </Link>
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

type ResendFeedback = { tone: 'success' | 'error'; text: string }

/** "Confira seu e-mail": mostra para onde o link foi e permite reenviar depois de 2 min. */
function CheckEmailCard({ email }: { email: string }) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS)
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<ResendFeedback | null>(null)

  // Contagem regressiva visual; recomeça a cada reenvio
  useEffect(() => {
    if (secondsLeft <= 0) return
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [secondsLeft])

  async function handleResend() {
    setSending(true)
    setFeedback(null)
    try {
      const message = await authApi.resendConfirmation(email)
      setFeedback({ tone: 'success', text: message })
      setSecondsLeft(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      if (errorStatus(err) === 429) {
        setFeedback({ tone: 'error', text: RATE_LIMIT_MESSAGE })
        setSecondsLeft(RESEND_COOLDOWN_SECONDS)
      } else {
        setFeedback({
          tone: 'error',
          text: 'Não deu para reenviar agora. Tente de novo em instantes.',
        })
      }
    } finally {
      setSending(false)
    }
  }

  const waiting = secondsLeft > 0

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border-default bg-bg-secondary p-6 text-center">
      <MailCheck className="h-10 w-10 text-accent-green" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-text-primary">Confira seu e-mail</h2>
      <p className="break-all text-sm font-semibold text-text-primary">{email}</p>
      <p className="text-sm text-text-secondary">
        Enviamos um link para confirmar sua conta. Ele vale por 48 horas. Confira
        também a caixa de spam.
      </p>

      {feedback && (
        <p
          className={
            feedback.tone === 'success'
              ? 'text-sm font-medium text-accent-green-deep'
              : 'text-sm text-accent-red-deep'
          }
          role={feedback.tone === 'success' ? 'status' : 'alert'}
        >
          {feedback.text}
        </p>
      )}

      <div className="flex w-full flex-col gap-2">
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          loading={sending}
          disabled={sending || waiting}
          onClick={() => void handleResend()}
        >
          Reenviar e-mail
        </Button>
        {waiting && (
          <p className="text-xs text-text-secondary tabular-nums">
            Dá para reenviar em {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}.
          </p>
        )}
      </div>

      <Link
        to={ROUTES.LOGIN}
        className="inline-flex min-h-[44px] items-center text-sm font-medium text-accent-blue hover:underline"
      >
        Voltar ao login
      </Link>
    </div>
  )
}

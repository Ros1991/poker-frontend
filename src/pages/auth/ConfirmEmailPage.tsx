import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Clock, MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { BrandLogo } from '../../components/brand/BrandLogo'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { Input } from '../../components/ui/Input'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { Button } from '../../components/ui/Button'
import { ROUTES } from '../../constants/routes'
import * as authApi from '../../api/auth.api'
import { useAuth } from '../../hooks/useAuth'
import { WRONG_CONFIRM_PASSWORD_MESSAGE } from '../../types/auth.types'
import { errorMessage, errorStatus } from '../../utils/httpErrors'
import {
  LAST_EMAIL_KEY,
  readStoredEmail,
  lastEmailMatching,
  type ForgotPasswordState,
} from '../../utils/authEmailStorage'

const INVALID_LINK_MESSAGE =
  'Link inválido ou expirado. Peça um novo e-mail de confirmação.'

const RATE_LIMIT_MESSAGE = 'Muitas tentativas seguidas. Espere um minuto.'

function forgetLastEmail() {
  try {
    localStorage.removeItem(LAST_EMAIL_KEY)
  } catch {
    // navegador sem armazenamento: nada a limpar
  }
}

/**
 * Link do e-mail de confirmação (/confirmar-email/:token, público). D16.10: mostra o e-mail (mascarado) da conta
 * do link e pede a senha escolhida no cadastro; token + senha certos confirmam e já entram no painel. Não
 * depende de nada guardado no navegador — dá para abrir o link em outro aparelho. Quem esqueceu a senha usa
 * "Esqueci minha senha", que também confirma o e-mail (D16.5). A `key` recria a tela se o token da URL mudar.
 */
export function ConfirmEmailPage() {
  const { token } = useParams<{ token: string }>()
  return <ConfirmEmail key={token ?? ''} token={token ?? ''} />
}

function ConfirmEmail({ token }: { token: string }) {
  // GET .../info não consome o link: pode repetir (StrictMode, "Tentar de novo") à vontade
  const info = useQuery({
    queryKey: ['confirm-email-info', token],
    queryFn: () => authApi.getConfirmEmailInfo(token),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
  const [invalidMessage, setInvalidMessage] = useState<string | null>(null)

  const infoStatus = errorStatus(info.error)
  const invalid =
    !token ||
    invalidMessage !== null ||
    (info.data !== undefined && !info.data.valid) ||
    (infoStatus !== undefined && infoStatus >= 400 && infoStatus < 500 && infoStatus !== 429)

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <BrandLogo variant="full" decorative className="h-36" />
          <h1 className="sr-only">Poker da Galera</h1>
          <p className="text-sm text-text-secondary">Confirmação de e-mail</p>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-secondary p-6">
          {invalid ? (
            <>
              <div
                className="flex items-start gap-2 rounded-lg border border-accent-red/40 bg-accent-red-soft p-3"
                role="alert"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0 text-accent-red"
                  aria-hidden="true"
                />
                <p className="text-sm text-accent-red-deep">{invalidMessage ?? INVALID_LINK_MESSAGE}</p>
              </div>
              <ResendConfirmationForm />
              <div className="flex justify-center">
                <BackToLogin />
              </div>
            </>
          ) : info.isPending ? (
            <div role="status" className="py-4">
              <LoadingSpinner text="Abrindo o link de confirmação…" />
            </div>
          ) : info.isError ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <Clock className="h-10 w-10 text-text-muted" aria-hidden="true" />
              <p className="text-sm text-text-primary" role="alert">
                {infoStatus === 429
                  ? RATE_LIMIT_MESSAGE
                  : 'Não deu para abrir o link agora. Confira a conexão e tente de novo.'}
              </p>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => void info.refetch()}
              >
                Tentar de novo
              </Button>
              <BackToLogin />
            </div>
          ) : (
            <ConfirmWithPasswordForm
              token={token}
              maskedEmail={info.data.email ?? ''}
              onInvalid={(message) => setInvalidMessage(message)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

const passwordSchema = z.object({
  password: z.string().min(1, 'Digite a senha do cadastro'),
})

type PasswordFormData = z.infer<typeof passwordSchema>

/** Senha do cadastro → confirma e entra (D16.10). Senha errada não gasta o link. */
function ConfirmWithPasswordForm({
  token,
  maskedEmail,
  onInvalid,
}: {
  token: string
  maskedEmail: string
  onInvalid: (message: string) => void
}) {
  const navigate = useNavigate()
  const { confirmEmail } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  // "Esqueci minha senha" (também confirma, D16.5) abre com o e-mail do cadastro feito neste navegador SÓ se ele bater
  // com o da conta do link; senão vazio — nunca o "Lembrar", que é de outra conta (o link de redefinição iria para ela)
  const [forgotState] = useState<ForgotPasswordState>(() => ({ email: lastEmailMatching(maskedEmail) }))

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '' },
  })

  async function onSubmit(data: PasswordFormData) {
    setIsLoading(true)
    setFormError(null)
    try {
      await confirmEmail(token, data.password)
      forgetLastEmail()
      toast.success('E-mail confirmado! Bem-vindo ao Poker da Galera.')
      navigate(ROUTES.INICIO, { replace: true })
    } catch (err) {
      const status = errorStatus(err)
      const message = errorMessage(err)
      if (status === 400 && message === WRONG_CONFIRM_PASSWORD_MESSAGE) {
        setError('password', { message: WRONG_CONFIRM_PASSWORD_MESSAGE }, { shouldFocus: true })
      } else if (status === 429) {
        // Limite por IP (sem corpo) ou senha errada demais (too_many_attempts: diz quanto esperar)
        setFormError(message ?? RATE_LIMIT_MESSAGE)
      } else if (status !== undefined && status >= 400 && status < 500) {
        onInvalid(message ?? INVALID_LINK_MESSAGE)
      } else {
        setFormError('Não deu para confirmar agora. Confira a conexão e tente de novo.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className="flex flex-col gap-4"
      noValidate
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <MailCheck className="h-10 w-10 text-accent-green" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-text-primary">Confirme seu e-mail</h2>
        <p className="break-all text-sm font-semibold text-text-primary" data-confirm-email>
          {maskedEmail}
        </p>
        <p className="text-sm text-text-secondary">
          Digite a senha que você escolheu no cadastro para confirmar a conta e entrar.
        </p>
      </div>

      <PasswordInput
        label="Senha do cadastro"
        placeholder="Sua senha"
        error={errors.password?.message}
        autoComplete="current-password"
        {...register('password')}
      />

      {formError && (
        <p className="text-sm text-accent-red-deep" role="alert">
          {formError}
        </p>
      )}

      <Button type="submit" loading={isLoading} className="w-full">
        Confirmar e entrar
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to={ROUTES.FORGOT_PASSWORD}
          state={forgotState}
          className="inline-flex min-h-[44px] items-center text-sm font-medium text-accent-blue hover:underline"
        >
          Esqueci minha senha
        </Link>
        <BackToLogin />
      </div>
      <p className="text-xs text-text-secondary">
        Esqueceu a senha? Redefinir pelo e-mail também confirma a conta.
      </p>
    </form>
  )
}

function BackToLogin() {
  return (
    <Link
      to={ROUTES.LOGIN}
      className="inline-flex min-h-[44px] items-center text-sm font-medium text-accent-blue hover:underline"
    >
      Voltar ao login
    </Link>
  )
}

const resendSchema = z.object({
  email: z.email('E-mail inválido'),
})

type ResendFormData = z.infer<typeof resendSchema>

/**
 * Pede um link novo. A resposta do backend é sempre neutra (não revela se o e-mail existe). O campo abre com o e-mail
 * do último cadastro neste navegador antes do "Lembrar e-mail e senha" (num aparelho emprestado, o "Lembrar" é de
 * outra conta).
 */
function ResendConfirmationForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [sentMessage, setSentMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResendFormData>({
    resolver: zodResolver(resendSchema),
    defaultValues: { email: readStoredEmail() },
  })

  async function onSubmit(data: ResendFormData) {
    setIsLoading(true)
    setError(null)
    try {
      setSentMessage(await authApi.resendConfirmation(data.email.trim()))
    } catch (err) {
      setError(
        errorStatus(err) === 429
          ? RATE_LIMIT_MESSAGE
          : 'Não deu para reenviar agora. Tente de novo em instantes.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (sentMessage) {
    return (
      <div className="flex flex-col items-center gap-3 text-center" role="status">
        <MailCheck className="h-10 w-10 text-accent-green" aria-hidden="true" />
        <p className="text-sm text-text-primary">{sentMessage}</p>
        <p className="text-xs text-text-secondary">
          O link novo vale por 48 horas. Confira também a caixa de spam.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className="flex flex-col gap-4"
      noValidate
    >
      <p className="text-sm text-text-secondary">
        Digite o e-mail da sua conta para receber um link novo.
      </p>

      <Input
        label="E-mail"
        type="email"
        placeholder="seu@email.com"
        error={errors.email?.message}
        autoComplete="email"
        {...register('email')}
      />

      {error && (
        <p className="text-sm text-accent-red-deep" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" loading={isLoading} className="w-full">
        Reenviar e-mail de confirmação
      </Button>
    </form>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, CheckCircle2, Clock, MailCheck } from 'lucide-react'
import { BrandLogo } from '../../components/brand/BrandLogo'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { ROUTES } from '../../constants/routes'
import * as authApi from '../../api/auth.api'
import { errorMessage, errorStatus } from '../../utils/httpErrors'

/** Mesma chave do LoginPage/RegisterPage: o cadastro guarda o e-mail aqui. */
const REMEMBERED_EMAIL_KEY = 'poker_remembered_email'
const LAST_EMAIL_KEY = 'poker_last_email'

const INVALID_LINK_MESSAGE =
  'Link inválido ou expirado. Peça um novo e-mail de confirmação.'

const RATE_LIMIT_MESSAGE = 'Muitas tentativas seguidas. Espere um minuto.'

type Phase =
  | { kind: 'loading' }
  | { kind: 'confirmed' }
  /** 4xx: link inválido, expirado, já usado ou revogado (mensagem do backend) */
  | { kind: 'invalid'; message: string }
  /** 429: o token não foi gasto; dá para tentar de novo daqui a pouco */
  | { kind: 'rateLimited' }
  /** Rede, timeout ou 5xx: o token também não foi gasto */
  | { kind: 'failed' }

function readRememberedEmail(): string {
  try {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? localStorage.getItem(LAST_EMAIL_KEY) ?? ''
  } catch {
    return ''
  }
}

/**
 * Link do e-mail de confirmação (/confirmar-email/:token, público). Confirma ao abrir e manda
 * para o login (D16.8: confirmar não loga). A `key` recria a tela se o token da URL mudar.
 */
export function ConfirmEmailPage() {
  const { token } = useParams<{ token: string }>()
  return <ConfirmEmail key={token ?? ''} token={token ?? ''} />
}

function ConfirmEmail({ token }: { token: string }) {
  const navigate = useNavigate()
  const [attempt, setAttempt] = useState(0)
  const [phase, setPhase] = useState<Phase>(() =>
    token ? { kind: 'loading' } : { kind: 'invalid', message: INVALID_LINK_MESSAGE },
  )

  // O token é de uso único: no StrictMode o efeito roda duas vezes e a segunda chamada daria
  // 400 ("já usado"), mostrando um erro falso. A ref guarda a requisição de cada tentativa e as
  // execuções repetidas do efeito só se inscrevem na mesma promessa.
  const requestRef = useRef<{ attempt: number; promise: Promise<void> } | null>(null)

  useEffect(() => {
    if (!token) return
    if (requestRef.current?.attempt !== attempt) {
      requestRef.current = { attempt, promise: authApi.confirmEmail(token) }
    }
    let active = true
    requestRef.current.promise.then(
      () => {
        if (active) setPhase({ kind: 'confirmed' })
      },
      (err: unknown) => {
        if (!active) return
        const status = errorStatus(err)
        if (status === 429) {
          setPhase({ kind: 'rateLimited' })
        } else if (status !== undefined && status >= 400 && status < 500) {
          setPhase({ kind: 'invalid', message: errorMessage(err) ?? INVALID_LINK_MESSAGE })
        } else {
          setPhase({ kind: 'failed' })
        }
      },
    )
    return () => {
      active = false
    }
  }, [token, attempt])

  function retry() {
    setPhase({ kind: 'loading' })
    setAttempt((a) => a + 1)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <BrandLogo variant="full" decorative className="h-36" />
          <h1 className="sr-only">Poker da Galera</h1>
          <p className="text-sm text-text-secondary">Confirmação de e-mail</p>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-secondary p-6">
          {phase.kind === 'loading' && (
            <div role="status" className="py-4">
              <LoadingSpinner text="Confirmando seu e-mail…" />
            </div>
          )}

          {phase.kind === 'confirmed' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-accent-green" aria-hidden="true" />
              <div role="status" className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold text-text-primary">E-mail confirmado!</h2>
                <p className="text-sm text-text-secondary">
                  Sua conta está liberada. Já dá para entrar.
                </p>
              </div>
              <Button
                type="button"
                className="w-full"
                onClick={() => navigate(ROUTES.LOGIN, { replace: true })}
              >
                Entrar
              </Button>
            </div>
          )}

          {(phase.kind === 'rateLimited' || phase.kind === 'failed') && (
            <div className="flex flex-col items-center gap-4 text-center">
              <Clock className="h-10 w-10 text-text-muted" aria-hidden="true" />
              <p className="text-sm text-text-primary" role="alert">
                {phase.kind === 'rateLimited'
                  ? RATE_LIMIT_MESSAGE
                  : 'Não deu para confirmar agora. Confira a conexão e tente de novo.'}
              </p>
              <Button type="button" variant="secondary" className="w-full" onClick={retry}>
                Tentar de novo
              </Button>
              <BackToLogin />
            </div>
          )}

          {phase.kind === 'invalid' && (
            <>
              <div
                className="flex items-start gap-2 rounded-lg border border-accent-red/40 bg-accent-red-soft p-3"
                role="alert"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0 text-accent-red"
                  aria-hidden="true"
                />
                <p className="text-sm text-accent-red-deep">{phase.message}</p>
              </div>
              <ResendConfirmationForm />
              <div className="flex justify-center">
                <BackToLogin />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
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

/** Pede um link novo. A resposta do backend é sempre neutra (não revela se o e-mail existe). */
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
    defaultValues: { email: readRememberedEmail() },
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

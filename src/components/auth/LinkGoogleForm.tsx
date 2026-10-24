import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Link2 } from 'lucide-react'
import { PasswordInput } from '../ui/PasswordInput'
import { Button } from '../ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { ROUTES } from '../../constants/routes'
import { errorMessage, errorStatus } from '../../utils/httpErrors'

interface LinkGoogleFormProps {
  /** E-mail da conta (o mesmo da conta Google) */
  email: string
  /** Ticket do 409 link_requires_password */
  ticket: string
  /** Para onde voltar depois de entrar (ex.: /parear/CODIGO) */
  returnTo: string
  onCancel: () => void
}

/**
 * "Já existe uma conta com este e-mail — digite sua senha para conectar o Google" (SPEC-20261023-1210, regra 6
 * da pesquisa §10): a senha da conta, uma vez, conecta o Google e entra (POST auth/login com linkTicket).
 */
export function LinkGoogleForm({ email, ticket, returnTo, onCancel }: LinkGoogleFormProps) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!password) {
      setFieldError('Digite a senha da conta')
      return
    }
    setFieldError(undefined)
    setError(null)
    setSubmitting(true)
    try {
      await login({ email, password, linkTicket: ticket })
      navigate(returnTo, { replace: true })
    } catch (err) {
      // 429 = senha errada demais (o backend diz quanto esperar)
      if (errorStatus(err) === 429)
        setError(errorMessage(err) ?? 'Muitas tentativas com senha errada. Espere alguns minutos e tente de novo.')
      else setError(errorMessage(err) ?? 'Não deu para conectar agora. Tente de novo em instantes.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-secondary p-6"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <Link2 className="h-8 w-8 text-accent-blue" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-text-primary">Conectar o Google à sua conta</h2>
        <p className="text-sm text-text-secondary">
          Já existe uma conta com este e-mail — digite sua senha para conectar o Google.
        </p>
        <p className="break-all text-sm font-semibold text-text-primary">{email}</p>
      </div>

      <PasswordInput
        label="Senha da conta"
        placeholder="Sua senha"
        autoComplete="current-password"
        autoFocus
        value={password}
        error={fieldError}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && (
        <p
          className="rounded-lg border border-accent-red/40 bg-accent-red-soft p-3 text-sm text-accent-red-deep"
          role="alert"
        >
          {error}
        </p>
      )}

      <Button type="submit" loading={submitting}>
        Conectar e entrar
      </Button>

      <p className="text-center text-sm text-text-secondary">
        Não lembra ou não tem senha?{' '}
        <Link to={ROUTES.FORGOT_PASSWORD} className="font-medium text-accent-blue hover:underline">
          Esqueci minha senha
        </Link>
      </p>

      <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
        Cancelar
      </Button>
    </form>
  )
}

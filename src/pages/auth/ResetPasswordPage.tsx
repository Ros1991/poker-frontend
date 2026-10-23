import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { BrandLogo } from '../../components/brand/BrandLogo'
import { toast } from 'sonner'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { Button } from '../../components/ui/Button'
import { ROUTES } from '../../constants/routes'
import * as authApi from '../../api/auth.api'

const resetSchema = z
  .object({
    newPassword: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
    confirmPassword: z.string().min(1, 'Confirme a senha nova'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Senhas não conferem',
    path: ['confirmPassword'],
  })

type ResetFormData = z.infer<typeof resetSchema>

const INVALID_LINK_MESSAGE =
  'Link inválido ou expirado. Peça um novo link em Esqueci minha senha.'

/**
 * Senha nova a partir do link do e-mail (/redefinir-senha/:token). Não há
 * pré-validação do token: o erro só aparece ao enviar (menos superfície anônima).
 */
export function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  })

  async function onSubmit(data: ResetFormData) {
    if (!token) {
      setServerError(INVALID_LINK_MESSAGE)
      return
    }
    setIsLoading(true)
    setServerError(null)
    setRateLimited(false)
    try {
      await authApi.resetPassword({ token, newPassword: data.newPassword })
      toast.success('Senha alterada. Entre com a senha nova.')
      navigate(ROUTES.LOGIN, { replace: true })
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      if (status === 429) {
        setRateLimited(true)
      } else if (status === 400) {
        const message = axios.isAxiosError(err)
          ? (err.response?.data as { message?: string } | undefined)?.message
          : undefined
        setServerError(message ?? INVALID_LINK_MESSAGE)
      } else {
        toast.error('Não deu para alterar a senha. Tente de novo em instantes.')
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
          <p className="text-sm text-text-secondary">Criar senha nova</p>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-secondary p-6"
        >
          <PasswordInput
            label="Nova senha"
            placeholder="Mínimo 6 caracteres"
            error={errors.newPassword?.message}
            autoComplete="new-password"
            {...register('newPassword')}
          />

          <PasswordInput
            label="Confirmar nova senha"
            placeholder="Repita a senha nova"
            error={errors.confirmPassword?.message}
            autoComplete="new-password"
            {...register('confirmPassword')}
          />

          {serverError && (
            <div
              className="flex flex-col gap-1 rounded-lg border border-accent-red/40 bg-accent-red-soft p-3"
              role="alert"
            >
              <p className="text-sm text-accent-red-deep">{serverError}</p>
              <Link
                to={ROUTES.FORGOT_PASSWORD}
                className="text-sm font-medium text-accent-blue hover:underline"
              >
                Pedir um novo link
              </Link>
            </div>
          )}

          {rateLimited && (
            <p className="text-sm text-accent-red-deep" role="alert">
              Muitas tentativas. Aguarde um minuto e tente de novo.
            </p>
          )}

          <Button type="submit" loading={isLoading} className="mt-2">
            Salvar senha nova
          </Button>

          <p className="text-center text-sm text-text-secondary">
            <Link
              to={ROUTES.LOGIN}
              className="font-medium text-accent-blue hover:underline"
            >
              Voltar ao login
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

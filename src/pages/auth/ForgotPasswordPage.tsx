import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { MailCheck } from 'lucide-react'
import { BrandLogo } from '../../components/brand/BrandLogo'
import { toast } from 'sonner'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { ROUTES } from '../../constants/routes'
import * as authApi from '../../api/auth.api'

const forgotSchema = z.object({
  email: z.email('E-mail inválido'),
})

type ForgotFormData = z.infer<typeof forgotSchema>

const REMEMBERED_EMAIL_KEY = 'poker_remembered_email'

const NEUTRAL_MESSAGE =
  'Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha. Confira também a caixa de spam.'

/** "Esqueci minha senha": pede o link por e-mail. A resposta é sempre neutra. */
export function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
    defaultValues: {
      email: localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '',
    },
  })

  async function onSubmit(data: ForgotFormData) {
    setIsLoading(true)
    setRateLimited(false)
    try {
      await authApi.forgotPassword({ email: data.email.trim() })
      setSent(true)
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      if (status === 429) {
        setRateLimited(true)
      } else {
        // Nunca revela se o e-mail existe: erro genérico
        toast.error('Não deu para enviar o pedido. Tente de novo em instantes.')
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
          <p className="text-sm text-text-secondary">Esqueci minha senha</p>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-border-default bg-bg-secondary p-6 text-center">
            <MailCheck className="h-10 w-10 text-accent-green" />
            <p className="text-sm text-text-secondary">{NEUTRAL_MESSAGE}</p>
            <p className="text-xs text-text-secondary">
              O link vale por 1 hora e só pode ser usado uma vez.
            </p>
            <Link
              to={ROUTES.LOGIN}
              className="text-sm font-medium text-accent-blue hover:underline"
            >
              Voltar ao login
            </Link>
          </div>
        ) : (
          <form
            onSubmit={(e) => void handleSubmit(onSubmit)(e)}
            className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-secondary p-6"
          >
            <p className="text-sm text-text-secondary">
              Digite o e-mail da sua conta. Se ele estiver cadastrado, você
              recebe um link para criar uma senha nova.
            </p>

            <Input
              label="E-mail"
              type="email"
              placeholder="seu@email.com"
              error={errors.email?.message}
              autoComplete="email"
              {...register('email')}
            />

            {rateLimited && (
              <p className="text-sm text-accent-red-deep" role="alert">
                Muitas tentativas. Aguarde um minuto e tente de novo.
              </p>
            )}

            <Button type="submit" loading={isLoading} className="mt-2">
              Enviar link
            </Button>

            <p className="text-center text-sm text-text-secondary">
              Lembrou a senha?{' '}
              <Link
                to={ROUTES.LOGIN}
                className="font-medium text-accent-blue hover:underline"
              >
                Voltar ao login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

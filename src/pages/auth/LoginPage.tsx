import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { BrandLogo } from '../../components/brand/BrandLogo'
import { toast } from 'sonner'
import { Input } from '../../components/ui/Input'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { ROUTES } from '../../constants/routes'

const loginSchema = z.object({
  email: z.email('E-mail invalido'),
  password: z.string().min(1, 'Senha e obrigatoria'),
  rememberMe: z.boolean().optional(),
})

type LoginFormData = z.infer<typeof loginSchema>

const REMEMBERED_EMAIL_KEY = 'poker_remembered_email'
const REMEMBERED_PASSWORD_KEY = 'poker_remembered_password'

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

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isLoading, setIsLoading] = useState(false)

  // Volta para onde a pessoa estava (ex.: o QR da TV abriu /parear/CODIGO)
  const from = (location.state as { from?: Location } | null)?.from
  const returnTo = from ? `${from.pathname}${from.search}` : ROUTES.HOME

  const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY)
  const rememberedPassword = decode(localStorage.getItem(REMEMBERED_PASSWORD_KEY))

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: rememberedEmail ?? '',
      password: rememberedPassword,
      rememberMe: !!rememberedEmail,
    },
  })

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true)
    try {
      if (data.rememberMe) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, data.email)
        localStorage.setItem(REMEMBERED_PASSWORD_KEY, encode(data.password))
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY)
        localStorage.removeItem(REMEMBERED_PASSWORD_KEY)
      }
      await login(data)
      navigate(returnTo, { replace: true })
    } catch {
      toast.error('E-mail ou senha incorretos.')
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
        </div>

        <form
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-secondary p-6"
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

          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border-default bg-bg-input text-accent-blue focus:ring-accent-blue"
                {...register('rememberMe')}
              />
              <span className="text-sm text-text-secondary">
                Lembrar e-mail e senha
              </span>
            </label>
            <Link
              to={ROUTES.FORGOT_PASSWORD}
              className="text-sm text-accent-blue hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>

          <Button type="submit" loading={isLoading} className="mt-2">
            Entrar
          </Button>

          <p className="text-center text-sm text-text-secondary">
            Nao tem uma conta?{' '}
            <Link
              to={ROUTES.REGISTER}
              className="font-medium text-accent-blue hover:underline"
            >
              Criar conta
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

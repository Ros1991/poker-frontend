import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { Spade } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '../../components/ui/Input'
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

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: rememberedEmail ?? '',
      rememberMe: !!rememberedEmail,
    },
  })

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true)
    try {
      if (data.rememberMe) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, data.email)
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY)
      }
      await login(data)
      navigate(ROUTES.HOME, { replace: true })
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
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-blue/10">
            <Spade className="h-8 w-8 text-accent-blue" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">PokerTM</h1>
          <p className="text-sm text-text-secondary">
            Gerenciamento de Torneios de Poker
          </p>
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

          <Input
            label="Senha"
            type="password"
            placeholder="Sua senha"
            error={errors.password?.message}
            autoComplete="current-password"
            {...register('password')}
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border-default bg-bg-input text-accent-blue focus:ring-accent-blue"
              {...register('rememberMe')}
            />
            <span className="text-sm text-text-secondary">Lembrar meu e-mail</span>
          </label>

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

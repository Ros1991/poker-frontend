import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { Spade } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { ROUTES } from '../../constants/routes'
import * as authApi from '../../api/auth.api'
import { setTokens } from '../../api/client'

const registerSchema = z
  .object({
    fullName: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
    nickname: z.string().optional(),
    email: z.email('E-mail invalido'),
    whatsapp: z.string().optional(),
    password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
    confirmPassword: z.string().min(1, 'Confirme sua senha'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Senhas nao conferem',
    path: ['confirmPassword'],
  })

type RegisterFormData = z.infer<typeof registerSchema>

export function RegisterPage() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  async function onSubmit(data: RegisterFormData) {
    setIsLoading(true)
    try {
      const response = await authApi.register({
        fullName: data.fullName,
        nickname: data.nickname,
        email: data.email,
        password: data.password,
        whatsapp: data.whatsapp,
      })
      setTokens(response.accessToken, response.refreshToken)
      toast.success('Conta criada com sucesso!')
      navigate(ROUTES.HOME, { replace: true })
      window.location.reload()
    } catch {
      toast.error('Erro ao criar conta. Verifique os dados.')
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
          <p className="text-sm text-text-secondary">Criar nova conta</p>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-secondary p-6"
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

          <Input
            label="Senha"
            type="password"
            placeholder="Minimo 6 caracteres"
            error={errors.password?.message}
            autoComplete="new-password"
            {...register('password')}
          />

          <Input
            label="Confirmar senha"
            type="password"
            placeholder="Repita sua senha"
            error={errors.confirmPassword?.message}
            autoComplete="new-password"
            {...register('confirmPassword')}
          />

          <Button type="submit" loading={isLoading} className="mt-2">
            Criar conta
          </Button>

          <p className="text-center text-sm text-text-secondary">
            Ja tem uma conta?{' '}
            <Link
              to={ROUTES.LOGIN}
              className="font-medium text-accent-blue hover:underline"
            >
              Fazer login
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

import { AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'

interface AccessDeniedStateProps {
  message?: string
}

/**
 * Estado de página para 403 da API (recurso de um home game de que o usuário não é
 * dono, membro nem Admin): mensagem clara + voltar, em vez de erro genérico ou spinner.
 */
export function AccessDeniedState({
  message = 'Você não tem acesso a esta página.',
}: AccessDeniedStateProps) {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <AlertCircle className="h-8 w-8 text-accent-red" />
      <p className="text-lg text-text-primary">{message}</p>
      <Button variant="secondary" onClick={() => navigate(-1)}>
        Voltar
      </Button>
    </div>
  )
}

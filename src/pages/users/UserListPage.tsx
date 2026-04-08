import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Users, AlertCircle, Shield } from 'lucide-react'
import * as usersApi from '../../api/users.api'
import type { UserRole } from '../../types/user.types'
import type { User } from '../../types/user.types'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { ROUTES, userEditPath } from '../../constants/routes'

const roleConfig: Record<
  UserRole,
  { label: string; color: 'purple' | 'blue' | 'green' | 'gray' }
> = {
  Admin: { label: 'Administrador', color: 'purple' },
  TournamentDirector: { label: 'Diretor de Torneio', color: 'blue' },
  Dealer: { label: 'Dealer', color: 'green' },
  Player: { label: 'Jogador', color: 'gray' },
}

export function UserListPage() {
  const navigate = useNavigate()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll(),
  })

  // Handle both paginated and array responses
  const users: User[] = data
    ? 'data' in data
      ? data.data
      : Array.isArray(data)
        ? data
        : []
    : []

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" text="Carregando usuários..." />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Usuários</h1>
          <p className="text-sm text-text-secondary">
            Gerencie os acessos ao sistema
          </p>
        </div>
        <Button
          onClick={() => navigate(ROUTES.USERS + '/novo')}
          className="sm:w-auto w-full"
        >
          <Plus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Error */}
      {isError && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <AlertCircle className="h-12 w-12 text-accent-red" />
          <p className="text-text-secondary">
            Erro ao carregar usuários. Tente novamente.
          </p>
        </div>
      )}

      {/* Empty */}
      {!isError && users.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Users className="h-12 w-12 text-text-muted" />
          <p className="text-lg font-medium text-text-secondary">
            Nenhum usuário cadastrado
          </p>
          <p className="text-sm text-text-muted">
            Crie o primeiro usuário para dar acesso ao sistema.
          </p>
        </div>
      )}

      {/* Table */}
      {users.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border-default bg-bg-secondary">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-text-muted">
                <th className="px-6 py-4 font-medium">Nome</th>
                <th className="px-6 py-4 font-medium">E-mail</th>
                <th className="px-6 py-4 font-medium">Perfil</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {users.map((user) => {
                const role = roleConfig[user.role] ?? {
                  label: user.role,
                  color: 'gray' as const,
                }
                return (
                  <tr
                    key={user.id}
                    className="hover:bg-bg-tertiary/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-text-muted" />
                        <span className="font-medium text-text-primary">
                          {user.personName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      {user.email}
                    </td>
                    <td className="px-6 py-4">
                      <Badge color={role.color}>{role.label}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge color={user.isActive ? 'green' : 'red'}>
                        {user.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          navigate(userEditPath(user.id))
                        }
                      >
                        Editar
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

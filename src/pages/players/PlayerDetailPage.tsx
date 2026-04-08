import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Edit,
  Mail,
  Phone,
  Trophy,
  DollarSign,
  Target,
  Calendar,
  AlertCircle,
} from 'lucide-react'
import * as personsApi from '../../api/persons.api'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { ROUTES, playerEditPath } from '../../constants/routes'

export function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    data: person,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['person', id],
    queryFn: () => personsApi.getById(id!),
    enabled: Boolean(id),
  })

  const { data: history } = useQuery({
    queryKey: ['person-history', id],
    queryFn: () => personsApi.getHistory(id!),
    enabled: Boolean(id),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" text="Carregando jogador..." />
      </div>
    )
  }

  if (isError || !person) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <AlertCircle className="h-12 w-12 text-accent-red" />
        <p className="text-text-secondary">Jogador não encontrado.</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(ROUTES.PLAYERS)}
        >
          Voltar para lista
        </Button>
      </div>
    )
  }

  const totalTournaments = history?.length ?? 0
  const bestPosition =
    history && history.length > 0
      ? Math.min(...history.map((h) => h.position))
      : null
  const totalPrize = history?.reduce((sum, h) => sum + h.prize, 0) ?? 0

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header Nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(ROUTES.PLAYERS)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(playerEditPath(id!))}
        >
          <Edit className="h-4 w-4" />
          Editar
        </Button>
      </div>

      {/* Profile Header */}
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border-default bg-bg-secondary p-6 sm:flex-row sm:items-start sm:gap-6">
        <Avatar src={person.photoUrl} name={person.fullName} size="xl" />
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <div>
            <h1 className="text-2xl font-bold text-text-primary text-center sm:text-left">
              {person.fullName}
            </h1>
            {person.nickname && (
              <p className="text-accent-blue text-center sm:text-left">
                &ldquo;{person.nickname}&rdquo;
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5 text-sm text-text-secondary">
            {person.email && (
              <a
                href={`mailto:${person.email}`}
                className="flex items-center gap-2 hover:text-text-primary transition-colors"
              >
                <Mail className="h-4 w-4" />
                {person.email}
              </a>
            )}
            {person.whatsapp && (
              <a
                href={`https://wa.me/${person.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-accent-green transition-colors"
              >
                <Phone className="h-4 w-4" />
                {person.whatsapp}
              </a>
            )}
          </div>

          {!person.isActive && <Badge color="red">Inativo</Badge>}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={<Trophy className="h-5 w-5 text-accent-blue" />}
          label="Torneios"
          value={String(totalTournaments)}
        />
        <StatCard
          icon={<Target className="h-5 w-5 text-yellow-400" />}
          label="Melhor Posição"
          value={bestPosition != null ? `${bestPosition}o` : '-'}
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5 text-accent-red" />}
          label="Total Investido"
          value="-"
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5 text-accent-green" />}
          label="Total Ganho"
          value={`R$ ${totalPrize.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
        />
      </div>

      {/* Tournament History */}
      <div className="rounded-xl border border-border-default bg-bg-secondary">
        <div className="border-b border-border-default px-6 py-4">
          <h2 className="text-lg font-semibold text-text-primary">
            Histórico de Torneios
          </h2>
        </div>

        {!history || history.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Calendar className="h-10 w-10 text-text-muted" />
            <p className="text-sm text-text-muted">
              Nenhum torneio registrado ainda.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-left text-text-muted">
                  <th className="px-6 py-3 font-medium">Data</th>
                  <th className="px-6 py-3 font-medium">Torneio</th>
                  <th className="px-6 py-3 font-medium text-center">
                    Posição
                  </th>
                  <th className="px-6 py-3 font-medium text-right">Prêmio</th>
                  <th className="px-6 py-3 font-medium text-right">Pontos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {history.map((entry) => (
                  <tr
                    key={entry.tournamentId}
                    className="hover:bg-bg-tertiary/50 transition-colors"
                  >
                    <td className="px-6 py-3 text-text-secondary whitespace-nowrap">
                      {new Date(entry.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-3 text-text-primary font-medium">
                      {entry.tournamentName}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <Badge
                        color={
                          entry.position === 1
                            ? 'yellow'
                            : entry.position === 2
                              ? 'gray'
                              : entry.position === 3
                                ? 'orange'
                                : 'gray'
                        }
                      >
                        {entry.position}o
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-right text-accent-green font-medium whitespace-nowrap">
                      {entry.prize > 0
                        ? `R$ ${entry.prize.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : '-'}
                    </td>
                    <td className="px-6 py-3 text-right text-text-secondary">
                      {entry.points > 0 ? entry.points : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border-default bg-bg-secondary p-4">
      {icon}
      <div>
        <p className="text-xl font-bold text-text-primary">{value}</p>
        <p className="text-xs text-text-muted">{label}</p>
      </div>
    </div>
  )
}

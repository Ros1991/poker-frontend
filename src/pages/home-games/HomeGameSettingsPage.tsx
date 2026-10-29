import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Edit, Lightbulb, MapPin, Trash2, Trophy, Users } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { ROUTES } from '../../constants/routes'
import { hasFeature } from '../../hooks/usePlan'
import { useHomeGame } from '../../hooks/useHomeGame'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import { formatPixKey } from '../../utils/pix'
import { INICIO_QUERY_KEY } from '../../api/inicio.api'
import type { HomeGame } from '../../types/homeGame.types'
import { HomeGameFormModal } from './HomeGameFormModal'
import { DeleteHomeGameModal } from './DeleteHomeGameModal'
import { useHomeGameShell } from './sections/homeGameShell'

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function count(n: number, one: string, many: string) {
  return n === 1 ? `1 ${one}` : `${n} ${many}`
}

function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl border border-border-default bg-bg-secondary p-4 lg:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-text-primary">{value}</dd>
    </div>
  )
}

/**
 * Configurações do clube (SPEC-20261029-1724, Clube e Liga): o que ficava no cabeçalho enorme do home game — nome do
 * clube, descrição, local, contagens, logo, PIX e valores padrão, Editar (o modal de sempre) e Excluir (só na Liga e
 * nunca o principal; `DeleteHomeGameModal`). No principal do Mesa não existe (o menu nem mostra: sem financeiro, logo ou
 * membros não há o que configurar); num home game extra de dono Mesa (ex-Liga rebaixada) o dono vê, para poder
 * excluí-lo (`visibleHomeGameSections`). Quem gerencia sem ser o dono (membro administrador) vê, mas só o dono edita (o
 * PUT só aceita o dono).
 */
export function HomeGameSettingsPage() {
  const { homeGame, isOwner, canDelete, label, showsHomeGames, markDeleted } = useHomeGameShell()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { refreshHomeGames } = useHomeGame()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // O principal é "o clube" (nome do clube); os outros da Liga são home games
  const noun = homeGame.isPrimary || !showsHomeGames ? 'clube' : 'home game'
  const showPix = hasFeature(homeGame.planFeatures, 'Payments')
  const logo = resolveMediaUrl(homeGame.logoUrl)

  async function saved(updated: HomeGame) {
    setEditOpen(false)
    queryClient.setQueryData(['homeGame', homeGame.id], updated)
    void queryClient.invalidateQueries({ queryKey: ['homeGame', homeGame.id] })
    void queryClient.invalidateQueries({ queryKey: INICIO_QUERY_KEY })
    await refreshHomeGames()
  }

  // Depois de excluir: desliga as consultas do id, troca o home game ativo e vai para o Início
  async function deleted() {
    markDeleted()
    await refreshHomeGames()
    void queryClient.invalidateQueries({ queryKey: INICIO_QUERY_KEY })
    navigate(ROUTES.INICIO, { replace: true })
    queryClient.removeQueries({ queryKey: ['homeGame', homeGame.id] })
  }

  return (
    <div className="space-y-4" data-home-game-settings>
      {homeGame.isNameDefault && isOwner && (
        <div className="flex items-start gap-3 rounded-xl border border-accent-gold/40 bg-accent-gold-soft p-4">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-accent-gold-deep" aria-hidden />
          <p className="flex-1 text-sm text-text-primary">
            <strong className="font-semibold">Dê um nome ao seu clube.</strong> Ele aparece no ranking público e na lista
            de torneios do telão. Toque em Editar.
          </p>
        </div>
      )}

      <Card
        title={noun === 'clube' ? 'Clube' : 'Home game'}
        action={
          isOwner ? (
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Edit className="h-4 w-4" />
              Editar
            </Button>
          ) : undefined
        }
      >
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border-default bg-bg-tertiary">
            {logo ? (
              <img src={logo} alt={`Logo de ${label}`} className="h-full w-full object-contain" />
            ) : (
              <Trophy className="h-7 w-7 text-text-muted" aria-hidden />
            )}
          </div>
          <dl className="grid flex-1 gap-3 sm:grid-cols-2">
            <Field label={noun === 'clube' ? 'Nome do clube' : 'Nome'} value={homeGame.name} />
            <Field
              label="Situação"
              value={homeGame.isActive ? <Badge color="green">Ativo</Badge> : <Badge color="gray">Inativo</Badge>}
            />
            <Field label="Descrição" value={homeGame.description || '—'} />
            <Field
              label="Local"
              value={
                homeGame.location ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-text-secondary" aria-hidden />
                    {homeGame.location}
                  </span>
                ) : (
                  '—'
                )
              }
            />
          </dl>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 border-t border-border-default pt-3 text-sm text-text-secondary">
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" aria-hidden />
            {count(homeGame.memberCount, 'membro', 'membros')}
          </span>
          <span className="flex items-center gap-1.5">
            <Trophy className="h-4 w-4" aria-hidden />
            {count(homeGame.tournamentCount, 'torneio', 'torneios')}
          </span>
        </div>
      </Card>

      <Card title={showPix ? 'PIX e valores padrão' : 'Valores padrão'}>
        <dl className="grid gap-3 sm:grid-cols-3">
          {showPix && (
            <>
              <Field label="Chave PIX" value={homeGame.pixKey ? formatPixKey(homeGame.pixKey) : '—'} />
              <Field label="Beneficiário" value={homeGame.pixBeneficiary || '—'} />
              <div className="hidden sm:block" />
            </>
          )}
          <Field label="Buy-in" value={<span className="tabular-nums">{formatCurrency(homeGame.defaultBuyIn)}</span>} />
          <Field label="Rebuy" value={<span className="tabular-nums">{formatCurrency(homeGame.defaultRebuy)}</span>} />
          <Field label="Add-on" value={<span className="tabular-nums">{formatCurrency(homeGame.defaultAddon)}</span>} />
        </dl>
      </Card>

      {!isOwner && (
        <p className="text-sm text-text-secondary">Só o dono altera estas configurações.</p>
      )}

      {canDelete && (
        <Card title="Excluir home game">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-text-secondary">
              Torneios, jogadores e rankings deste home game saem de todas as telas. O home game da sua conta nunca é
              excluído.
            </p>
            <Button
              variant="secondary"
              className="shrink-0 text-accent-red-deep hover:bg-accent-red-soft"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Excluir home game
            </Button>
          </div>
        </Card>
      )}

      <HomeGameFormModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        homeGame={homeGame}
        noun={noun}
        onSuccess={(updated) => void saved(updated)}
      />

      {canDelete && (
        <DeleteHomeGameModal
          isOpen={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          homeGameId={homeGame.id}
          homeGameName={homeGame.name}
          onDeleted={deleted}
        />
      )}
    </div>
  )
}

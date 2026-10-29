import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Crown,
  House,
  Shield,
  Spade,
  Sparkles,
  UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'
import { BrandLogo } from '../brand/BrandLogo'
import { Badge } from '../ui/Badge'
import { useAuth } from '../../hooks/useAuth'
import { homeGameLabel, useAccountNav } from '../../hooks/useAccountNav'
import { useMePlayer } from '../../hooks/useMePlayer'
import { ROUTES, homeGameSectionPath } from '../../constants/routes'
import { homeGameSectionTab } from './navTabs'

interface SidebarProps {
  className?: string
  onNavigate?: () => void
}

const adminItems = [
  { to: ROUTES.USERS, label: 'Administração', icon: Shield },
  // SPEC-20261027-1312: chave da Anthropic, limite, recursos (ex.: "Tirar o fundo"), uso e preços
  { to: ROUTES.ADMIN_AI, label: 'Inteligência artificial', icon: Sparkles },
]

const itemClass = (active: boolean, collapsed: boolean) =>
  cn(
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
    collapsed && 'justify-center px-2',
    active
      ? 'bg-accent-blue-soft text-accent-blue'
      : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
  )

function GroupTitle({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  if (collapsed) return null
  return (
    <div className="px-3 mb-2">
      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{children}</span>
    </div>
  )
}

function Divider() {
  return <div className="my-3 mx-3 border-t border-border-default" />
}

/**
 * Menu lateral por plano (SPEC-20261029-1724, D9/D18) — as seções da conta (Mesa e Clube) ou do home game atual (Liga),
 * como rotas:
 * - Mesa: Início · Torneios · Estruturas · Jogadores · Conta (Meu perfil, Meu plano) · Sistema (Admin);
 * - Clube: Início · Torneios · Rankings · Estruturas · Jogadores · Membros · Configurações · Conta · Sistema;
 * - Liga (ou conta que acessa mais de um home game): o mesmo, com o nome do home game atual no topo do bloco — a troca
 *   fica no seletor do cabeçalho. Não existe mais a lista "Meus Home Games".
 * As seções seguem o plano do DONO do home game e a permissão de quem está logado (`visibleHomeGameSections`). Dentro de
 * um torneio, o mesmo menu com "← Torneios" e a seção Torneios marcada (o painel do torneio não muda de layout).
 * Na Conta, "Meus torneios" (área do jogador, SPEC-20261029-1726) aparece só quando a conta tem pelo menos uma inscrição
 * vinculada (`GET me/player`).
 */
export function Sidebar({ className, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const { user } = useAuth()
  const { pathname } = useLocation()
  const { route, current, currentId, sections, showSelector } = useAccountNav()
  const player = useMePlayer()
  const playsSomewhere = (player.data?.tournamentCount ?? 0) > 0

  const isAdmin = user?.role === 'Admin'
  const onInicio = pathname === ROUTES.INICIO

  const sectionItem = (key: (typeof sections)[number]) => {
    const tab = homeGameSectionTab(key)
    const active = route.section === key && (!route.homeGameId || route.homeGameId === currentId)
    return (
      <SidebarLink
        key={key}
        to={homeGameSectionPath(currentId!, key)}
        label={tab.label}
        icon={tab.icon}
        active={active}
        collapsed={collapsed}
        onNavigate={onNavigate}
        dataKey={key}
      />
    )
  }

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border-default bg-bg-secondary transition-all duration-300',
        collapsed ? 'w-16' : 'w-60',
        className,
      )}
      data-sidebar
    >
      <div
        className={cn(
          'flex h-16 items-center border-b border-border-default',
          collapsed ? 'justify-center px-2' : 'px-4',
        )}
      >
        {collapsed ? <BrandLogo variant="mark" className="h-9" /> : <BrandLogo variant="lockup" className="h-9" />}
      </div>

      <nav className="flex-1 overflow-y-auto py-4" aria-label="Menu principal">
        <ul className="flex flex-col gap-1 px-2">
          <li>
            <SidebarLink
              to={ROUTES.INICIO}
              label="Início"
              icon={House}
              active={onInicio}
              collapsed={collapsed}
              onNavigate={onNavigate}
              dataKey="inicio"
            />
          </li>
        </ul>

        {currentId && (
          <>
            {/* Liga (ou quem acessa mais de um home game): o home game atual no topo do bloco */}
            {showSelector && current && !collapsed && (
              <div className="mt-4 mb-2 flex items-center gap-2 px-3" data-sidebar-home-game>
                <span className="truncate text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  {homeGameLabel(current, user)}
                </span>
                {!current.isActive && <Badge color="gray">Inativo</Badge>}
              </div>
            )}
            <ul className={cn('flex flex-col gap-1 px-2', !(showSelector && current && !collapsed) && 'mt-1')}>
              {/* Dentro de um torneio: volta para a lista de torneios */}
              {route.tournamentId && route.homeGameId && (
                <li>
                  <Link
                    to={homeGameSectionPath(route.homeGameId, 'torneios')}
                    onClick={onNavigate}
                    title={collapsed ? 'Voltar para Torneios' : undefined}
                    className={itemClass(false, collapsed)}
                    data-sidebar-back
                  >
                    <ArrowLeft className="h-5 w-5 flex-shrink-0" aria-hidden />
                    {!collapsed && <span>Torneios</span>}
                    {collapsed && <span className="sr-only">Voltar para Torneios</span>}
                  </Link>
                </li>
              )}
              {sections.map((key) => (
                <li key={key}>{sectionItem(key)}</li>
              ))}
            </ul>
          </>
        )}

        {/* Conta (SPEC-20261023-1205) */}
        <Divider />
        <GroupTitle collapsed={collapsed}>Conta</GroupTitle>
        <ul className="flex flex-col gap-1 px-2">
          {/* Área do jogador (SPEC-20261029-1726): só com inscrição vinculada à conta */}
          {playsSomewhere && (
            <li data-sidebar-item="meus-torneios">
              <SidebarNavLink to={ROUTES.MY_TOURNAMENTS} label="Meus torneios" icon={Spade} collapsed={collapsed} onNavigate={onNavigate} />
            </li>
          )}
          {/* Meu perfil (SPEC-20261023-1211), ao lado de "Meu plano" */}
          <li>
            <SidebarNavLink to={ROUTES.MY_PROFILE} label="Meu perfil" icon={UserRound} collapsed={collapsed} onNavigate={onNavigate} />
          </li>
          <li>
            <SidebarNavLink to={ROUTES.MY_PLAN} label="Meu plano" icon={Crown} collapsed={collapsed} onNavigate={onNavigate} />
          </li>
        </ul>

        {/* Admin Section */}
        {isAdmin && (
          <>
            <Divider />
            <GroupTitle collapsed={collapsed}>Sistema</GroupTitle>
            <ul className="flex flex-col gap-1 px-2">
              {adminItems.map((item) => (
                <li key={item.to}>
                  <SidebarNavLink to={item.to} label={item.label} icon={item.icon} collapsed={collapsed} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>

      {/* Rodapé do menu: manual de uso público (SPEC-20261026-1910), em outra aba para não sair do painel */}
      <div className="border-t border-border-default px-2 py-2">
        <a
          href={ROUTES.MANUAL}
          target="_blank"
          rel="noopener"
          onClick={onNavigate}
          title={collapsed ? 'Manual de uso' : undefined}
          aria-label={collapsed ? 'Manual de uso (abre em outra aba)' : undefined}
          className={cn(
            'flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary',
            collapsed && 'justify-center px-2',
          )}
          data-manual-link
        >
          <BookOpen className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {!collapsed && <span>Manual de uso</span>}
        </a>
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center border-t border-border-default py-3 text-text-secondary hover:text-text-primary transition-colors min-h-[44px]"
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
      >
        {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </button>
    </aside>
  )
}

/** Item com a marca de "aqui" decidida pela seção (também nas sub-telas: formulários, ficha, ranking, torneio) */
function SidebarLink({
  to,
  label,
  icon: Icon,
  active,
  collapsed,
  onNavigate,
  dataKey,
}: {
  to: string
  label: string
  icon: LucideIcon
  active: boolean
  collapsed: boolean
  onNavigate?: () => void
  dataKey?: string
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={itemClass(active, collapsed)}
      data-sidebar-item={dataKey}
    >
      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden />
      {collapsed ? <span className="sr-only">{label}</span> : <span>{label}</span>}
    </Link>
  )
}

/** Item das telas da conta (a marca vem da própria rota) */
function SidebarNavLink({
  to,
  label,
  icon: Icon,
  collapsed,
  onNavigate,
}: {
  to: string
  label: string
  icon: LucideIcon
  collapsed: boolean
  onNavigate?: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={({ isActive }) => itemClass(isActive, collapsed)}
    >
      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden />
      {collapsed ? <span className="sr-only">{label}</span> : <span>{label}</span>}
    </NavLink>
  )
}

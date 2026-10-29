import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, MoreHorizontal, Settings } from 'lucide-react'
import * as homeGamesApi from '../../api/homeGames.api'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { AccessDeniedState } from '../../components/common/AccessDeniedState'
import { isForbiddenError } from '../../utils/httpErrors'
import { useAuth } from '../../hooks/useAuth'
import { useTabScrollReset } from '../../hooks/useTabScrollReset'
import { homeGameLabel, useAccountNav } from '../../hooks/useAccountNav'
import { ROUTES, homeGameSectionPath } from '../../constants/routes'
import type { HomeGameSection } from '../../constants/routes'
import { homeGameSectionTab, sectionFromLegacyTab, visibleHomeGameSections } from '../../components/layout/navTabs'
import type { HomeGameShellContext } from './sections/homeGameShell'

/**
 * Casca do home game (SPEC-20261029-1724): as abas de antes viraram seções por rota (`/home-games/:id/<seção>`, ver
 * `navTabs.ts`), abertas pelo `<Outlet>`. A casca carrega o home game, confere o acesso (403 → AccessDeniedState),
 * manda para Torneios a seção que este home game não mostra (ex.: Membros para quem não gerencia, Configurações no
 * principal do Mesa) e desenha o cabeçalho de UMA linha: o nome da seção — e, quando "home game" aparece como conceito (Liga, ou
 * conta que acessa mais de um), o nome do home game e o selo Inativo —, com "⋯" → Configurações no celular. Nome do
 * clube, descrição, local, contagens, Editar e Excluir ficam em Configurações (`HomeGameSettingsPage`).
 */
export function HomeGameDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { route, showSelector } = useAccountNav()
  const section: HomeGameSection = route.section ?? 'torneios'
  // Excluído (SPEC-20261026-1126): estado (não ref) desliga o enabled da consulta do id excluído
  const [deleted, setDeleted] = useState(false)
  const live = !!id && !deleted

  const { data: homeGame, isLoading, isError, error } = useQuery({
    queryKey: ['homeGame', id],
    queryFn: () => homeGamesApi.getById(id!),
    enabled: live,
    // Contagens de Configurações (membros/torneios — SPEC-20261026-1907) sempre frescas ao abrir
    refetchOnMount: 'always',
  })

  // Trocar de seção com a página rolada abre a seção nova do começo; vindo de outra tela com o <main> ainda rolado,
  // abre do topo (o mesmo comportamento das abas de antes, agora por rota)
  const contentRef = useRef<HTMLDivElement>(null)
  useTabScrollReset(section, id, contentRef)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
      </div>
    )
  }

  // 403: não é dono, membro nem Admin deste home game
  if (isForbiddenError(error)) return <AccessDeniedState />

  if (isError || !homeGame) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-text-primary text-lg">Não foi possível carregar esta página.</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate(ROUTES.INICIO)}>
          Voltar ao Início
        </Button>
      </div>
    )
  }

  const isOwner = homeGame.ownerId === user?.id
  // canManage vem da API (dono, membro administrador ou Admin do sistema); sem o campo, o que dá para saber aqui
  const canManage = homeGame.canManage ?? (user?.role === 'Admin' || isOwner)
  const visible = visibleHomeGameSections({ ...homeGame, canManage, isOwner })
  // Seção que este home game não mostra: Torneios (a URL antiga ou digitada não cai numa tela vazia)
  if (!visible.includes(section)) {
    return <Navigate to={homeGameSectionPath(homeGame.id, 'torneios')} replace />
  }

  const label = homeGameLabel(homeGame, user)
  const context: HomeGameShellContext = {
    homeGame,
    canManage,
    isOwner,
    // Excluir: só um home game além do principal (só a Liga cria), dono ou Admin do sistema
    canDelete: !homeGame.isPrimary && (user?.role === 'Admin' || isOwner),
    label,
    showsHomeGames: showSelector,
    markDeleted: () => setDeleted(true),
  }
  const settingsVisible = visible.includes('configuracoes') && section !== 'configuracoes'

  return (
    <div className="space-y-4 lg:space-y-6">
      <header className="flex min-h-[44px] items-center gap-3" data-section-header={section}>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h1 className="shrink-0 text-2xl font-bold text-text-primary">{homeGameSectionTab(section).label}</h1>
          {showSelector && (
            <span className="truncate text-base font-medium text-text-secondary" data-section-home-game>
              · {label}
            </span>
          )}
          {!homeGame.isActive && (
            <Badge color="gray" className="shrink-0 self-center">
              Inativo
            </Badge>
          )}
        </div>
        {settingsVisible && <SectionMoreMenu homeGameId={homeGame.id} />}
      </header>

      {/* data-tab-content: começo da seção aberta (a troca de seção com a página rolada volta para cá) */}
      <div ref={contentRef} data-tab-content={section}>
        <Outlet context={context} />
      </div>
    </div>
  )
}

/** "⋯" do cabeçalho no celular (no computador Configurações fica no menu lateral) */
function SectionMoreMenu({ homeGameId }: { homeGameId: string }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()

  // Fecha ao tocar fora, no Esc e ao trocar de tela
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setOpen(false)
  }

  return (
    <div ref={box} className="relative lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Mais opções"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
        data-section-more
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[12rem] rounded-xl border border-border-default bg-bg-secondary p-1 shadow-lg"
        >
          <Link
            role="menuitem"
            to={homeGameSectionPath(homeGameId, 'configuracoes')}
            className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium text-text-primary hover:bg-bg-tertiary"
          >
            <Settings className="h-4 w-4 text-text-secondary" aria-hidden />
            Configurações
          </Link>
        </div>
      )}
    </div>
  )
}

/** `/home-games/:id` e o `?tab=` de antes da SPEC-20261029-1724 → a seção (`blinds` → Estruturas; sem aba → Torneios) */
export function HomeGameIndexRedirect() {
  const { id } = useParams<{ id: string }>()
  const { search } = useLocation()
  const tab = new URLSearchParams(search).get('tab')
  return <Navigate to={homeGameSectionPath(id!, sectionFromLegacyTab(tab))} replace />
}

/** Rotas antigas com o id na URL (`/home-games/:id/edit`, `/home-games/:id/tournaments`) → a seção */
export function LegacySectionRedirect({ section }: { section: HomeGameSection }) {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={homeGameSectionPath(id!, section)} replace />
}

import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { cn } from '../../utils/cn'
import { useAuth } from '../../hooks/useAuth'
import { useHomeGame } from '../../hooks/useHomeGame'
import { homeGameLabel, useAccountNav } from '../../hooks/useAccountNav'
import { ROUTES, homeGameSectionPath } from '../../constants/routes'
import { visibleHomeGameSections } from './navTabs'
import type { HomeGame } from '../../types/homeGame.types'

/**
 * Seletor de home game no cabeçalho (SPEC-20261029-1724, D8): "Nome ▾" → a lista + "Criar home game". Trocar de home
 * game é como trocar de empresa: o menu, a barra de baixo e as seções passam a ser do escolhido (que fica guardado
 * neste navegador). Aparece na Liga e para quem acessa mais de um home game (membro do clube de outra pessoa); no Mesa e
 * no Clube sem outro clube não existe (D18). "Criar home game" só na Liga. Na Liga a palavra é "home game"; para quem
 * só participa do clube de outra pessoa, "clube".
 */
export function HomeGameSelector({ className }: { className?: string }) {
  const { user } = useAuth()
  const { selectHomeGame } = useHomeGame()
  const { current, homeGames, isLiga, route } = useAccountNav()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

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
  // Fecha ao trocar de tela (ajuste de estado durante o render)
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setOpen(false)
  }

  const noun = isLiga ? 'home game' : 'clube'
  // Os da conta primeiro (o principal à frente), depois os de outras pessoas — cada grupo na ordem da API (por nome)
  const rank = (hg: HomeGame) => (hg.ownerId !== user?.id ? 2 : hg.isPrimary ? 0 : 1)
  const ordered = [...homeGames].sort((a, b) => rank(a) - rank(b))
  const currentLabel = current ? homeGameLabel(current, user) : 'Carregando…'

  // Vai para a mesma seção no escolhido (se ele mostra), senão Torneios
  function choose(homeGame: HomeGame) {
    setOpen(false)
    selectHomeGame(homeGame)
    const sections = visibleHomeGameSections({ ...homeGame, isOwner: homeGame.ownerId === user?.id })
    const keep = route.section && sections.includes(route.section) ? route.section : 'torneios'
    navigate(homeGameSectionPath(homeGame.id, keep))
  }

  return (
    <div ref={box} className={cn('relative min-w-0', className)} data-home-game-selector>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Trocar de ${noun}: ${currentLabel}`}
        className="flex min-h-[44px] max-w-full items-center gap-1.5 rounded-lg border border-border-default bg-bg-primary px-3 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-tertiary"
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-text-secondary transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={isLiga ? 'Seus home games' : 'Seus clubes'}
          className="absolute left-0 top-full z-40 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border-default bg-bg-secondary p-1 shadow-lg"
        >
          <ul className="max-h-[60vh] overflow-y-auto">
            {ordered.map((hg) => {
              const selected = current?.id === hg.id
              const mine = hg.ownerId === user?.id
              return (
                <li key={hg.id}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => choose(hg)}
                    className={cn(
                      'flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      selected ? 'bg-accent-blue-soft text-accent-blue' : 'text-text-primary hover:bg-bg-tertiary',
                    )}
                    data-home-game-option={hg.id}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{homeGameLabel(hg, user)}</span>
                      <span className="block truncate text-xs text-text-secondary">
                        {mine ? (hg.isPrimary ? 'Sua conta' : `Seu ${noun}`) : 'Você participa'}
                        {!hg.isActive && ' · Inativo'}
                      </span>
                    </span>
                    {selected && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                  </button>
                </li>
              )
            })}
          </ul>
          {isLiga && (
            <div className="mt-1 border-t border-border-default pt-1">
              <Link
                to={ROUTES.HOME_GAME_NEW}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium text-accent-green-deep hover:bg-accent-green-soft"
                data-create-home-game
              >
                <Plus className="h-4 w-4" aria-hidden />
                Criar home game
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

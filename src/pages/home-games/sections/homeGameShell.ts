import { useOutletContext } from 'react-router-dom'
import type { HomeGame } from '../../../types/homeGame.types'

/**
 * O que a casca do home game (`HomeGameDetailPage`) passa para a seção aberta pelo `<Outlet>` (SPEC-20261029-1724):
 * o home game já carregado e as permissões de quem está logado.
 */
export interface HomeGameShellContext {
  homeGame: HomeGame
  /** Dono, membro administrador ou Admin do sistema: cria, edita e remove dentro do home game */
  canManage: boolean
  /** Dono: edita os dados do home game (o PUT só aceita o dono) */
  isOwner: boolean
  /** Excluir o home game: só na Liga, nunca o principal, dono ou Admin do sistema */
  canDelete: boolean
  /** Rótulo do home game para a interface (nome do clube; no Mesa, o nome da conta) */
  label: string
  /** "Home game" aparece como conceito (Liga, ou conta que acessa mais de um) */
  showsHomeGames: boolean
  /** Depois de excluir (Configurações): desliga as consultas do id antes de sair */
  markDeleted: () => void
}

export function useHomeGameShell(): HomeGameShellContext {
  return useOutletContext<HomeGameShellContext>()
}

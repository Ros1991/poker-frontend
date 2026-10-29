export const ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/esqueci-senha',
  RESET_PASSWORD: '/redefinir-senha/:token',
  CONFIRM_EMAIL: '/confirmar-email/:token',
  HOME: '/',
  HOME_GAMES: '/home-games',
  HOME_GAME_NEW: '/home-games/new',
  HOME_GAME_DETAIL: '/home-games/:id',
  HOME_GAME_EDIT: '/home-games/:id/edit',
  TOURNAMENTS: '/home-games/:id/tournaments',
  TOURNAMENT_NEW: '/home-games/:id/tournaments/new',
  TOURNAMENT_DASHBOARD: '/tournaments/:id',
  TOURNAMENT_EDIT: '/tournaments/:id/edit',
  PLAYERS: '/players',
  PLAYER_NEW: '/players/new',
  PLAYER_DETAIL: '/players/:id',
  PLAYER_EDIT: '/players/:id/edit',
  RANKINGS_BY_HOME_GAME: '/home-games/:homeGameId/rankings',
  RANKING_NEW: '/home-games/:homeGameId/rankings/new',
  RANKING_DETAIL: '/rankings/:id',
  RANKING_EDIT: '/rankings/:id/edit',
  /** Administração (SPEC-20261023-1206, só Admin): contas; sem "criar usuário" (D14) */
  USERS: '/users',
  /** Ficha da conta na Administração */
  USER_DETAIL: '/users/:id',
  USER_EDIT: '/users/:id/edit',
  /** Administração → Inteligência artificial (SPEC-20261027-1312, só Admin): chave, limite, recursos, uso e preços */
  ADMIN_AI: '/admin/ia',
  /** Página "Meu plano" (SPEC-20261023-1205): plano, uso e tabela comparativa */
  MY_PLAN: '/meu-plano',
  /** Página "Meu perfil" (SPEC-20261023-1211): dados, foto, senha, contas conectadas, aparelhos e excluir conta */
  MY_PROFILE: '/meu-perfil',
  /** Boas-vindas do primeiro acesso (SPEC-20261023-1212): completar cadastro → escolher plano */
  WELCOME: '/boas-vindas',
  BLIND_STRUCTURE_NEW: '/home-games/:homeGameId/blinds/new',
  BLIND_STRUCTURE_EDIT: '/home-games/:homeGameId/blinds/:id/edit',
  DEALER_TERMINAL: '/dealer/:tournamentId',
  DEALER_MINI_TV: '/dealer/:tournamentId/telao',
  DEALER_ACCESS: '/dealer/acesso/:code',
  TV: '/tv',
  TV_DISPLAY: '/tv/:tournamentId',
  PAIR_DISPLAY: '/parear/:code?',
  PUBLIC_RANKING: '/r/:slug',
  PUBLIC_RANKING_PLAYER: '/r/:slug/:personId',
  /** Termos de uso (SPEC-20261023-1207); sem JavaScript o nginx serve public/termos.html */
  TERMS: '/termos',
  /** Política de privacidade (SPEC-20261023-1207); sem JavaScript o nginx serve public/privacidade.html */
  PRIVACY: '/privacidade',
  /** Manual de uso público (SPEC-20261026-1910): índice dos módulos, sem login, carregado à parte pelo boot.tsx */
  MANUAL: '/manual',
  /** Um módulo do manual (`/manual/terminal-do-dealer`…) */
  MANUAL_MODULE: '/manual/:slug',
} as const

/** `/manual` (sem slug) ou `/manual/<módulo>` — SPEC-20261026-1910 */
export function manualPath(slug?: string) {
  return slug ? `/manual/${slug}` : '/manual'
}

export function resetPasswordPath(token: string) {
  return `/redefinir-senha/${token}`
}

export function confirmEmailPath(token: string) {
  return `/confirmar-email/${token}`
}

export function tournamentDashboardPath(id: string) {
  return `/tournaments/${id}`
}

export function tournamentEditPath(id: string) {
  return `/tournaments/${id}/edit`
}

export function dealerTerminalPath(tournamentId: string) {
  return `/dealer/${tournamentId}`
}

export function dealerMiniTvPath(tournamentId: string) {
  return `/dealer/${tournamentId}/telao`
}

export function tvDisplayPath(tournamentId: string) {
  return `/tv/${tournamentId}`
}

export function pairDisplayPath(code?: string) {
  return code ? `/parear/${code}` : '/parear'
}

export function dealerAccessPath(code: string) {
  return `/dealer/acesso/${code}`
}

export function homeGameDetailPath(id: string) {
  return `/home-games/${id}`
}

export function homeGameEditPath(id: string) {
  return `/home-games/${id}/edit`
}

export function homeGameTournamentsPath(id: string) {
  return `/home-games/${id}/tournaments`
}

export function homeGameRankingsPath(homeGameId: string) {
  return `/home-games/${homeGameId}/rankings`
}

export function rankingNewPath(homeGameId: string) {
  return `/home-games/${homeGameId}/rankings/new`
}

export function playerDetailPath(id: string) {
  return `/players/${id}`
}

export function playerEditPath(id: string) {
  return `/players/${id}/edit`
}

export function rankingDetailPath(id: string) {
  return `/rankings/${id}`
}

export function rankingEditPath(id: string) {
  return `/rankings/${id}/edit`
}

export function publicRankingPath(slug: string) {
  return `/r/${slug}`
}

export function publicRankingPlayerPath(slug: string, personId: string) {
  return `/r/${slug}/${personId}`
}

export function userEditPath(id: string) {
  return `/users/${id}/edit`
}

export function userDetailPath(id: string) {
  return `/users/${id}`
}

export function blindStructureNewPath(homeGameId: string) {
  return `/home-games/${homeGameId}/blinds/new`
}

export function blindStructureEditPath(homeGameId: string, id: string) {
  return `/home-games/${homeGameId}/blinds/${id}/edit`
}

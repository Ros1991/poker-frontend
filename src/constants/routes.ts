export const ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/esqueci-senha',
  RESET_PASSWORD: '/redefinir-senha/:token',
  CONFIRM_EMAIL: '/confirmar-email/:token',
  HOME: '/',
  /**
   * Início da conta (SPEC-20261029-1724): a porta de entrada de quem está logado — `/` com sessão, o login, o cadastro
   * confirmado e as boas-vindas caem aqui. `/home-games` (a lista antiga) redireciona para cá.
   */
  INICIO: '/inicio',
  /** Criar home game (só a Liga): abre o modal de criar por cima do Início */
  HOME_GAME_NEW: '/home-games/new',
  /** Casca do home game: `/home-games/:id` (e o `?tab=` antigo) redireciona para a seção */
  HOME_GAME_DETAIL: '/home-games/:id',
  /**
   * Seção do home game (SPEC-20261029-1724), um esquema só para os três planos: torneios, rankings, estruturas,
   * jogadores, membros e configuracoes. No Mesa e no Clube o `:id` é o do home game principal invisível (a URL carrega
   * o id; a interface nunca diz "home game").
   */
  HOME_GAME_SECTION: '/home-games/:id/:section',
  /** Antigo "Editar home game" (página): redireciona para Configurações */
  HOME_GAME_EDIT: '/home-games/:id/edit',
  /** Antiga lista de torneios do home game: redireciona para a seção Torneios */
  TOURNAMENTS: '/home-games/:id/tournaments',
  TOURNAMENT_NEW: '/home-games/:id/tournaments/new',
  TOURNAMENT_DASHBOARD: '/tournaments/:id',
  TOURNAMENT_EDIT: '/tournaments/:id/edit',
  /** Antiga lista de jogadores do home game ativo: redireciona para a seção Jogadores */
  PLAYERS: '/players',
  PLAYER_NEW: '/players/new',
  PLAYER_DETAIL: '/players/:id',
  PLAYER_EDIT: '/players/:id/edit',
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
  /**
   * Área do jogador (SPEC-20261029-1726): os torneios em que a conta jogou, em qualquer clube (inscrições cujo jogador
   * está vinculado à conta pelo e-mail — SPEC-20261029-1725), com filtro por clube e paginação
   */
  MY_TOURNAMENTS: '/meus-torneios',
  /** Um torneio da conta: ao vivo (relógio compacto + a minha ficha) ou o resultado, se já terminou */
  MY_TOURNAMENT_LIVE: '/meus-torneios/:id',
  /** Boas-vindas do primeiro acesso (SPEC-20261023-1212): completar cadastro → escolher plano */
  WELCOME: '/boas-vindas',
  BLIND_STRUCTURE_NEW: '/home-games/:homeGameId/blinds/new',
  BLIND_STRUCTURE_EDIT: '/home-games/:homeGameId/blinds/:id/edit',
  DEALER_TERMINAL: '/dealer/:tournamentId',
  /** Telão no celular do dealer e do organizador (SPEC-20261029-1721): a mesma guarda do terminal */
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

/** `/meus-torneios/<id>` — o torneio da conta (SPEC-20261029-1726) */
export function myTournamentLivePath(tournamentId: string) {
  return `/meus-torneios/${tournamentId}`
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

export function tvDisplayPath(tournamentId: string) {
  return `/tv/${tournamentId}`
}

export function pairDisplayPath(code?: string) {
  return code ? `/parear/${code}` : '/parear'
}

export function dealerAccessPath(code: string) {
  return `/dealer/acesso/${code}`
}

/**
 * Seções do home game (SPEC-20261029-1724). `estruturas` era a aba `blinds` e `configuracoes` é nova (nome do clube,
 * descrição, local, logo, PIX, valores padrão, editar e excluir).
 */
export type HomeGameSection = 'torneios' | 'rankings' | 'estruturas' | 'jogadores' | 'membros' | 'configuracoes'

export const HOME_GAME_SECTION_KEYS: readonly HomeGameSection[] = [
  'torneios',
  'rankings',
  'estruturas',
  'jogadores',
  'membros',
  'configuracoes',
]

export function isHomeGameSection(value: string | null | undefined): value is HomeGameSection {
  return !!value && (HOME_GAME_SECTION_KEYS as readonly string[]).includes(value)
}

/** `/home-games/<id>/<seção>` */
export function homeGameSectionPath(homeGameId: string, section: HomeGameSection = 'torneios') {
  return `/home-games/${homeGameId}/${section}`
}

/** Novo torneio no home game (o formulário de sempre) */
export function tournamentNewPath(homeGameId: string) {
  return `/home-games/${homeGameId}/tournaments/new`
}

/** Telão no celular do dealer (SPEC-20261029-1721) */
export function dealerMiniTvPath(tournamentId: string) {
  return `/dealer/${tournamentId}/telao`
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

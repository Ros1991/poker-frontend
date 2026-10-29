import type { PlanName } from './plan.types'
import type { TournamentStatus } from './tournament.types'

/**
 * `GET me/inicio` (SPEC-20261029-1724): o Início da conta numa consulta só. Espelha o `InicioResponse` do backend.
 */
export interface InicioTournament {
  id: string
  name: string
  status: TournamentStatus
  date: string
  totalEntries: number
  playersRemaining: number
}

/** Torneio iniciado (inscrições abertas, em andamento ou rebuys finalizados) */
export interface InicioLiveTournament extends InicioTournament {
  homeGameId: string
  /** Nome do home game para a interface (null no principal de dono Mesa) */
  homeGameName: string | null
  currentLevel: number | null
  /** Relógio correndo (falso = pausado) */
  isTimerRunning: boolean
  /** Quem está logado gerencia o home game do torneio */
  canManage: boolean
}

export interface InicioHomeGame {
  id: string
  name: string
  /** Null no principal de dono Mesa (no Mesa não existe nome de clube) */
  displayName: string | null
  isPrimary: boolean
  /** O principal ainda tem o nome padrão "Clube de <nome>" */
  isNameDefault: boolean
  isActive: boolean
  /** A conta logada é a dona (senão é membro) */
  isOwner: boolean
  canManage: boolean
  ownerId: string
  ownerName: string | null
  /** Plano efetivo do dono */
  ownerPlan: PlanName
  tournamentCount: number
  /** Os 5 mais recentes pela data (sem cancelados) */
  recent: InicioTournament[]
  /** Primeiro ainda não finalizado pela data */
  next: InicioTournament | null
  /** Último finalizado */
  last: InicioTournament | null
}

export interface Inicio {
  /** Plano efetivo da conta */
  plan: PlanName
  /** "Home game" como conceito (só a Liga) */
  homeGamesVisible: boolean
  /** Home games como dono contando o principal (Mesa 1, Clube 1, Liga 3) */
  maxOwnedHomeGames: number
  primaryHomeGameId: string | null
  live: InicioLiveTournament[]
  /** Os da conta primeiro (o principal à frente), depois os de outras pessoas em que ela é membro */
  homeGames: InicioHomeGame[]
}

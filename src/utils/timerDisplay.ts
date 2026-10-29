// Apresentação do relógio de blinds compartilhada pelos telões (TV pareada e o telão no celular) e pelo terminal do
// dealer (SPEC-20261029-1720). A cor do relógio, o tempo até o intervalo e as fichas em jogo saíram do TvDisplayPage na
// SPEC-20261029-1721, para o telão no celular (MiniTvPage / CompactClock) mostrar exatamente o mesmo que a TV.
import type { TimerState } from '../types/blind.types'

const NUMBER = new Intl.NumberFormat('pt-BR')

/** Número no formato do Brasil: 100000 → "100.000" */
export function formatChips(value: number): string {
  return NUMBER.format(value)
}

/** Texto dos blinds no telão: "100.000 / 200.000" */
export function blindsText(smallBlind: number, bigBlind: number): string {
  return `${formatChips(smallBlind)} / ${formatChips(bigBlind)}`
}

/** Degraus de tamanho de fonte: [como sempre, um degrau menor, dois degraus menores] */
export type BlindsSizes = readonly [string, string, string]

/**
 * Degrau de tamanho pelo comprimento do texto "SB / BB" (com os pontos de milhar e os espaços em volta da barra):
 * até 13 caracteres ("2.000 / 4.000") fica como sempre (0); de 14 a 16 ("10.000 / 20.000") um degrau menor (1); 17 ou
 * mais ("100.000 / 200.000") dois degraus menores (2). Junto com `whitespace-nowrap`, os blinds cabem numa linha.
 */
export function blindsSizeStep(text: string): 0 | 1 | 2 {
  const length = text.trim().length
  return length <= 13 ? 0 : length <= 16 ? 1 : 2
}

/**
 * Classe de fonte do texto "SB / BB" pelo comprimento (`blindsSizeStep`). Cada tela passa os 3 degraus dela como
 * classes literais (o Tailwind só gera a classe que aparece inteira no código).
 */
export function blindsSizeClass(text: string, sizes: BlindsSizes): string {
  return sizes[blindsSizeStep(text)]
}

/** Não existe nível depois do atual: o "Próximo" fica desligado (o servidor recusa com 400) */
export function isLastLevel(state: Pick<TimerState, 'isLastLevel'>): boolean {
  return state.isLastLevel === true
}

/**
 * Fim da estrutura: último nível com o tempo esgotado. O relógio fica travado em 00:00 com os blinds do último nível e o
 * selo "Último nível" (D2 — para continuar, o organizador acrescenta níveis na aba Blinds).
 */
export function isStructureFinished(state: Pick<TimerState, 'isLastLevel' | 'remainingSeconds'>): boolean {
  return isLastLevel(state) && state.remainingSeconds <= 0
}

/** Cor do relógio pela urgência, como na TV: marinho; dourado-deep no último minuto; vermelho nos 30 s finais */
export function timerUrgencyClass(remainingSeconds: number): string {
  return remainingSeconds <= 30 ? 'text-accent-red' : remainingSeconds <= 60 ? 'text-accent-gold-deep' : 'text-text-primary'
}

/** Duração em "MM:SS", ou "H:MM:SS" a partir de 1 hora (o "Próximo intervalo") */
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** O mínimo de um nível da estrutura que o "Próximo intervalo" precisa (TvBlindLevel do telão ou o nível do torneio) */
export interface BreakLevel {
  levelNumber: number
  durationMinutes: number
  isBreak: boolean
}

/**
 * Segundos até o próximo intervalo: o que falta do nível atual mais a duração dos níveis até o intervalo. null durante o
 * intervalo, sem níveis carregados ou sem intervalo pela frente (a tela mostra "Agora" ou "—").
 */
export function secondsToBreak(
  state: Pick<TimerState, 'isBreak' | 'currentLevel' | 'remainingSeconds'>,
  levels: readonly BreakLevel[] | null | undefined,
): number | null {
  if (state.isBreak || !levels || levels.length === 0) return null
  const nextBreak = levels
    .filter((l) => l.isBreak && l.levelNumber > state.currentLevel)
    .sort((a, b) => a.levelNumber - b.levelNumber)[0]
  if (!nextBreak) return null
  let secs = state.remainingSeconds
  for (const l of levels) {
    if (!l.isBreak && l.levelNumber > state.currentLevel && l.levelNumber < nextBreak.levelNumber) secs += l.durationMinutes * 60
  }
  return secs
}

/** Texto do "Próximo intervalo": "Agora" no intervalo, o tempo que falta, ou "—" sem intervalo pela frente */
export function nextBreakText(isBreak: boolean, seconds: number | null): string {
  if (isBreak) return 'Agora'
  return seconds != null ? formatDuration(seconds) : '—'
}

/** Campos do torneio que entram na conta das fichas (o TournamentResponse e o torneio do snapshot do telão) */
export interface ChipsTournament {
  startingStack?: number | null
  rebuyStack?: number | null
  addonStack?: number | null
  punctualityBonusCount?: number | null
  punctualityBonusChips?: number | null
}

/**
 * Fichas em jogo: por inscrição, stack inicial + rebuys × fichas do rebuy + add-ons × fichas do add-on (SPEC-20261027-1311:
 * `addonCount`, o antigo duplo = 2), mais o bônus de pontualidade (quantidade de jogadores × fichas do bônus). Conta todas
 * as inscrições (as fichas de quem saiu ficaram na mesa).
 */
export function chipsInPlay(
  tournament: ChipsTournament | null | undefined,
  entries: readonly { rebuyCount?: number | null; addonCount?: number | null }[] | null | undefined,
): number {
  const startingStack = tournament?.startingStack ?? 0
  const rebuyStack = tournament?.rebuyStack ?? startingStack
  const addonStack = tournament?.addonStack ?? startingStack
  const bonus = (tournament?.punctualityBonusCount ?? 0) * (tournament?.punctualityBonusChips ?? 0)
  return (
    (entries ?? []).reduce(
      (sum, e) => sum + startingStack + (e.rebuyCount ?? 0) * rebuyStack + (e.addonCount ?? 0) * addonStack,
      0,
    ) + bonus
  )
}

/** Média por jogador que ainda joga (0 sem ninguém jogando) */
export function averageStack(totalChips: number, playing: number): number {
  return playing > 0 ? Math.round(totalChips / playing) : 0
}

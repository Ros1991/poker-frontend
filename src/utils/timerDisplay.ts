// Apresentação do relógio de blinds compartilhada pelos telões (TV pareada e, depois, o telão no celular) e pelo
// terminal do dealer (SPEC-20261029-1720).
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

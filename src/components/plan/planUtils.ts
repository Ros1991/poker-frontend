/**
 * Utilidades de plano (SPEC-20261023-1205) — textos, formatação e deduções a partir do catálogo.
 *
 * Regra: preços e limites vêm SEMPRE do catálogo (`PlanDefinition`, de `GET public/plans` ou de
 * `MyPlan.catalog`); aqui só há rótulos e a forma de escrever cada número.
 *
 * API estável:
 * - `PLAN_FEATURE_LABELS: Record<PlanFeature, string>` — nome curto do recurso ("Controle de mesas").
 * - `PLAN_FEATURE_DESCRIPTIONS: Record<PlanFeature, string>` — frase para cadeado/modal.
 * - `PLAN_TAGLINES: Record<PlanName, string>` — "Para quem" de cada plano.
 * - `PLAN_SOURCE_LABELS: Record<PlanSource, string>` — "Cortesia", "Teste"…
 * - `PLAN_LIMIT_TITLES: Record<PlanLimitCode, string>` — título do modal por `code`.
 * - `formatPlanPrice(value)` → "Grátis" | "R$ 49,90"; `formatYearlyPrice(value)` → "R$ 499".
 * - `describeHomeGames(def)`, `describeTournaments(def)`, `describeMembers(def)`, `describeTv(def)`
 *   → frases da tabela comparativa a partir dos limites do catálogo (home games: Mesa e Clube "Um só: a sua
 *   conta é o clube"; Liga "Até 3 home games (o da conta + 2)" — SPEC-20261029-1723).
 * - `homeGamesSummary(plans)` → "Home games: Mesa e Clube — um só, a sua conta; Liga até 3" (com o número do catálogo).
 * - `findPlan(plans, name)`, `requiredPlanFor(feature, plans)`, `nextPlan(current, plans)`.
 * - `planIncludes(def, feature)`.
 * - `formatPlanSource(source, note)` → "Cortesia — fundador".
 * - `formatTimeUntil(target, now?)` → "3 dias e 4 horas" | "5 horas e 10 minutos" | "12 minutos".
 * - `useTimeUntil(target, tickMs?)` → `{ label, reached }` atualizando sozinho (contagem regressiva).
 * - `planExpiry(expiresAt, now?)` → `{ expiresAt, expired, daysLeft, soon }` (`soon` = vence em ≤ 7 dias).
 * - `formatPlanDate(iso)` → "23/10/2026".
 * - `planRequestMessage(plan, homeGameName, email)` → texto pronto do WhatsApp do suporte
 *   ("Olá! Quero o plano Clube para o home game X." + "Minha conta: e-mail").
 * - `EXPIRY_WARNING_DAYS` = 7.
 */
import { useEffect, useState } from 'react'
import type {
  PlanDefinition,
  PlanFeature,
  PlanLimitCode,
  PlanName,
  PlanSource,
} from '../../types/plan.types'

export const PLAN_FEATURE_LABELS: Record<PlanFeature, string> = {
  Tables: 'Controle de mesas',
  Prizes: 'Premiação',
  Payments: 'Pagamentos e PIX',
  CostExtras: 'Custos extras',
  Financial: 'Financeiro consolidado',
  Rankings: 'Ranking de temporada',
  DealerQr: 'Terminal do dealer por QR',
  PixCardOnTv: 'Card PIX no telão',
  ClubLogoOnTv: 'Logo do clube no telão',
}

export const PLAN_FEATURE_DESCRIPTIONS: Record<PlanFeature, string> = {
  Tables: 'Sorteio de mesas, assentos, mover jogadores e quebrar mesas.',
  Prizes: 'Cálculo da premiação, confirmação e prêmio pago a cada colocado.',
  Payments: 'Marcar inscrições como pagas, saldo de cada jogador e PIX do dia.',
  CostExtras: 'Custos extras do torneio (staff, comida, ranking) descontados do prêmio.',
  Financial: 'Totais, caixa e conferência do dinheiro da noite.',
  Rankings: 'Ranking de temporada com pontuação e página pública para o grupo.',
  DealerQr: 'O dealer opera o torneio pelo celular, com sua autorização.',
  PixCardOnTv: 'Card do PIX com QR na tela da TV para o pagamento dos jogadores.',
  ClubLogoOnTv: 'A logo do seu clube no telão e no ranking público, sem o selo.',
}

/** "Para quem" de cada plano (texto de venda; os números vêm do catálogo). */
export const PLAN_TAGLINES: Record<PlanName, string> = {
  Mesa: 'Jogo entre amigos de vez em quando',
  Clube: 'O home game semanal de verdade',
  Liga: 'Mais de um clube, liga, circuito ou bar',
}

export const PLAN_SOURCE_LABELS: Record<PlanSource, string> = {
  Manual: 'Atribuído pelo suporte',
  Cortesia: 'Cortesia',
  Trial: 'Teste',
  Assinatura: 'Assinatura',
}

export const PLAN_LIMIT_TITLES: Record<PlanLimitCode, string> = {
  feature_locked: 'Recurso de plano pago',
  home_games_limit: 'Limite de home games',
  tournaments_per_week: 'Limite de torneios da semana',
  members_limit: 'Limite de membros',
}

/** Dias antes do vencimento em que o banner aparece. */
export const EXPIRY_WARNING_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const currencyNoCents = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/** Preço mensal: "Grátis" para 0, senão "R$ 49,90". */
export function formatPlanPrice(value: number): string {
  return value <= 0 ? 'Grátis' : currency.format(value)
}

/** Preço anual sem centavos quando redondo: "R$ 499". */
export function formatYearlyPrice(value: number): string {
  return currencyNoCents.format(value)
}

function plural(n: number, singular: string, pluralForm: string) {
  return `${n} ${n === 1 ? singular : pluralForm}`
}

/**
 * Linha "home games" da tabela comparativa (SPEC-20261029-1723, D18): no Mesa e no Clube a conta tem um só,
 * invisível — "Um só: a sua conta é o clube"; só a Liga tem home games ("Até 3 home games (o da conta + 2)"). Sem
 * `homeGamesVisible` no catálogo (API antiga), decide pelo limite.
 */
export function describeHomeGames(def: PlanDefinition): string {
  const n = def.maxOwnedHomeGames
  const visible = def.homeGamesVisible ?? n > 1
  if (!visible) return 'Um só: a sua conta é o clube'
  return `Até ${n} home games (o da conta + ${n - 1})`
}

/**
 * Resumo da regra de home games por plano (Meu plano, SPEC-20261029-1723): "Home games: Mesa e Clube — um só, a sua
 * conta; Liga até 3." O número da Liga vem do catálogo (sem catálogo, 3).
 */
export function homeGamesSummary(plans: readonly PlanDefinition[] | undefined): string {
  const max = Math.max(0, ...(plans ?? []).filter((p) => p.homeGamesVisible ?? p.maxOwnedHomeGames > 1).map((p) => p.maxOwnedHomeGames))
  return `Home games: Mesa e Clube — um só, a sua conta; Liga até ${max || 3}.`
}

export function describeTournaments(def: PlanDefinition): string {
  const n = def.tournamentsPer7Days
  if (n === null) return 'Torneios ilimitados'
  return `${plural(n, 'torneio', 'torneios')} a cada 7 dias`
}

export function describeMembers(def: PlanDefinition): string {
  const n = def.maxMembersPerHomeGame
  if (n === null) return 'Membros ilimitados'
  if (n === 0) return 'Sem membros além do dono'
  return `Até ${plural(n, 'membro', 'membros')} além do dono`
}

export function planIncludes(def: PlanDefinition | undefined, feature: PlanFeature): boolean {
  return !!def && def.features.includes(feature)
}

/** Como o telão aparece no plano, deduzido das features e do selo do catálogo. */
export function describeTv(def: PlanDefinition): string {
  if (planIncludes(def, 'ClubLogoOnTv')) return 'Telão completo com a logo do clube'
  const complete = planIncludes(def, 'Prizes') || planIncludes(def, 'Tables')
  if (complete) return def.showBadge ? 'Telão completo, selo discreto' : 'Telão completo'
  return 'Telão com relógio, jogadores e eliminados (selo + QR)'
}

export function findPlan(
  plans: readonly PlanDefinition[] | undefined,
  name: string | null | undefined,
): PlanDefinition | undefined {
  if (!plans || !name) return undefined
  return plans.find((p) => p.name === name)
}

/** Menor plano (por `order`) que libera o recurso, pelo catálogo. */
export function requiredPlanFor(
  feature: PlanFeature,
  plans: readonly PlanDefinition[] | undefined,
): PlanName | null {
  const sorted = [...(plans ?? [])].sort((a, b) => a.order - b.order)
  return sorted.find((p) => p.features.includes(feature))?.name ?? null
}

/** Plano seguinte ao atual no catálogo (para limites sem `requiredPlan`). */
export function nextPlan(
  current: string | null | undefined,
  plans: readonly PlanDefinition[] | undefined,
): PlanName | null {
  const sorted = [...(plans ?? [])].sort((a, b) => a.order - b.order)
  const idx = sorted.findIndex((p) => p.name === current)
  return sorted[idx + 1]?.name ?? null
}

/** "Cortesia — fundador"; sem nota, só a origem. */
export function formatPlanSource(
  source: PlanSource | null | undefined,
  note: string | null | undefined,
): string | null {
  const label = source ? PLAN_SOURCE_LABELS[source] ?? source : null
  const cleanNote = note?.trim() || null
  if (label && cleanNote) return `${label} — ${cleanNote}`
  return label ?? cleanNote
}

function toMs(target: string | Date): number {
  return typeof target === 'string' ? new Date(target).getTime() : target.getTime()
}

/**
 * Tempo até `target` em pt-BR: "3 dias e 4 horas", "1 dia", "5 horas e 10 minutos", "12 minutos",
 * "menos de 1 minuto"; "agora" quando já passou.
 */
export function formatTimeUntil(target: string | Date, now: number = Date.now()): string {
  const ms = toMs(target) - now
  if (!Number.isFinite(ms) || ms <= 0) return 'agora'
  if (ms < MINUTE_MS) return 'menos de 1 minuto'
  if (ms < HOUR_MS) return plural(Math.ceil(ms / MINUTE_MS), 'minuto', 'minutos')
  if (ms < DAY_MS) {
    const hours = Math.floor(ms / HOUR_MS)
    const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS)
    const h = plural(hours, 'hora', 'horas')
    return minutes > 0 ? `${h} e ${plural(minutes, 'minuto', 'minutos')}` : h
  }
  const days = Math.floor(ms / DAY_MS)
  const hours = Math.floor((ms % DAY_MS) / HOUR_MS)
  const d = plural(days, 'dia', 'dias')
  return hours > 0 ? `${d} e ${plural(hours, 'hora', 'horas')}` : d
}

/**
 * Contagem regressiva que se atualiza sozinha (a cada `tickMs`, default 30 s).
 * `label` null quando não há alvo; `reached` true quando o alvo já passou.
 */
export function useTimeUntil(
  target: string | null | undefined,
  tickMs = 30_000,
): { label: string | null; reached: boolean } {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!target) return
    const id = window.setInterval(() => setNow(Date.now()), tickMs)
    return () => window.clearInterval(id)
  }, [target, tickMs])

  if (!target) return { label: null, reached: false }
  const reached = toMs(target) <= now
  return { label: reached ? null : formatTimeUntil(target, now), reached }
}

export interface PlanExpiryInfo {
  expiresAt: string | null
  /** O vencimento já passou (o plano efetivo virou Mesa) */
  expired: boolean
  /** Dias inteiros restantes, arredondado para cima (null sem vencimento ou já vencido) */
  daysLeft: number | null
  /** Vence em ≤ EXPIRY_WARNING_DAYS dias e ainda não venceu */
  soon: boolean
}

export function planExpiry(
  expiresAt: string | null | undefined,
  now: number = Date.now(),
): PlanExpiryInfo {
  if (!expiresAt) return { expiresAt: null, expired: false, daysLeft: null, soon: false }
  const ms = toMs(expiresAt) - now
  if (!Number.isFinite(ms)) return { expiresAt, expired: false, daysLeft: null, soon: false }
  if (ms <= 0) return { expiresAt, expired: true, daysLeft: null, soon: false }
  const daysLeft = Math.ceil(ms / DAY_MS)
  return { expiresAt, expired: false, daysLeft, soon: daysLeft <= EXPIRY_WARNING_DAYS }
}

/**
 * Mensagem pronta para o WhatsApp do suporte: "Olá! Quero o plano Clube para o home game X." +
 * a conta, para o suporte achar o usuário. Sem home game: "...no Poker da Galera.".
 */
export function planRequestMessage(
  plan: string | null | undefined,
  homeGameName: string | null | undefined,
  email: string | null | undefined,
): string {
  const target = plan ? `o plano ${plan}` : 'um plano pago'
  const first = homeGameName
    ? `Olá! Quero ${target} para o home game ${homeGameName}.`
    : `Olá! Quero ${target} no Poker da Galera.`
  return email ? `${first}\nMinha conta: ${email}` : first
}

export function formatPlanDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR')
}

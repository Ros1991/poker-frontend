import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { Clock, Lock, QrCode, ShieldOff, Tablet, UserX } from 'lucide-react'
import * as dealerAccessApi from '../../api/dealerAccess.api'
import { planLimitFromError } from '../../api/client'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import {
  getDealerName,
  getDeviceKey,
  setDealerName,
  setDealerSession,
} from '../../utils/deviceSessions'
import { dealerTerminalPath } from '../../constants/routes'

const POLL_INTERVAL_MS = 3000
const NAME_MIN = 2
const NAME_MAX = 40

type EndedIcon = 'rejected' | 'expired' | 'revoked' | 'invalid' | 'plan'

type Phase =
  | { kind: 'form' }
  | {
      kind: 'waiting'
      requestId: string
      name: string
      tournamentName: string
      /** O aparelho já tinha pedido aprovado: só busca o token, sem mostrar "aguardando" */
      reopening: boolean
    }
  | { kind: 'ended'; icon: EndedIcon; title: string; detail: string; retry: boolean }

const ENDED = {
  rejected: (): Phase => ({
    kind: 'ended',
    icon: 'rejected',
    title: 'O organizador não autorizou',
    detail: 'Fale com o organizador e, se for o caso, peça acesso de novo.',
    retry: true,
  }),
  expired: (): Phase => ({
    kind: 'ended',
    icon: 'expired',
    title: 'Pedido vencido',
    detail: 'O pedido venceu. Leia o QR de novo.',
    retry: true,
  }),
  revoked: (): Phase => ({
    kind: 'ended',
    icon: 'revoked',
    title: 'Seu acesso foi encerrado pelo organizador',
    detail: 'Se precisar voltar ao terminal, leia o QR de novo e peça acesso outra vez.',
    retry: true,
  }),
  reread: (): Phase => ({
    kind: 'ended',
    icon: 'invalid',
    title: 'Leia o QR de novo neste aparelho',
    detail: 'O pedido foi feito em outro aparelho ou o torneio já terminou.',
    retry: true,
  }),
  notFound: (): Phase => ({
    kind: 'ended',
    icon: 'invalid',
    title: 'Pedido não encontrado',
    detail: 'Pedido não encontrado. Leia o QR de novo.',
    retry: true,
  }),
  invalidQr: (): Phase => ({
    kind: 'ended',
    icon: 'invalid',
    title: 'Este QR não vale mais',
    detail: 'Este QR não vale mais. Peça um novo ao organizador.',
    retry: false,
  }),
  tournamentOver: (): Phase => ({
    kind: 'ended',
    icon: 'invalid',
    title: 'O torneio já terminou',
    detail: 'Não dá mais para entrar como dealer neste torneio.',
    retry: false,
  }),
  /**
   * 402 (SPEC-20261023-1205, D5): o terminal do dealer por QR é recurso do plano pago e o dono do
   * torneio está no Mesa (ou caiu para ele depois de gerar o QR). Vale no pedido e na emissão do
   * token; a mensagem pronta para o celular vem do backend.
   */
  planLocked: (requiredPlan: string | null | undefined, message: string | null | undefined): Phase => ({
    kind: 'ended',
    icon: 'plan',
    title: `Recurso do plano ${requiredPlan || 'Clube'}`,
    detail:
      message ||
      'O terminal do dealer por QR não está liberado neste torneio. Avise o organizador.',
    retry: false,
  }),
} as const

const ENDED_ICON = {
  rejected: UserX,
  expired: Clock,
  revoked: ShieldOff,
  invalid: QrCode,
  plan: Lock,
} as const

const NAME_ERROR = `Informe seu nome (de ${NAME_MIN} a ${NAME_MAX} letras).`

/**
 * Prepara o nome para a regra do backend (DealerAccessService.NormalizeName): espaço de
 * qualquer tipo vira um só; saem controle, formatação invisível (zero-width, bidi override),
 * uso privado e surrogate solto — o backend RECUSA (400) nome que chegue com eles, então
 * quem colou um nome assim não fica travado; Unicode em NFC.
 * `[^\S\uFEFF]|\u0085` é o char.IsWhiteSpace do .NET
 * (o \s do JS inclui U+FEFF, que lá é formatação).
 */
function normalizeName(value: string) {
  return value
    .replace(/[^\S\uFEFF]|\u0085/gu, ' ')
    .replace(/[\p{Cc}\p{Cf}\p{Co}\p{Cs}]/gu, '')
    .normalize('NFC')
    .replace(/ {2,}/g, ' ')
    .trim()
}

/** 2 a 40 caracteres, com pelo menos 2 letras/dígitos (char.IsLetterOrDigit: \p{L} e \p{Nd}). */
function isValidName(clean: string) {
  const lettersOrDigits = clean.match(/[\p{L}\p{Nd}]/gu)?.length ?? 0
  return clean.length >= NAME_MIN && clean.length <= NAME_MAX && lettersOrDigits >= NAME_MIN
}

function responseMessage(err: unknown): string | undefined {
  return axios.isAxiosError(err)
    ? (err.response?.data as { message?: string } | undefined)?.message
    : undefined
}

/**
 * O dealer leu o QR (SPEC-20261023-1208): informa o nome, o aparelho cria um pedido e
 * a tela fica aguardando o organizador autorizar (consulta a cada 3 s). Aprovado, guarda
 * a sessão do dealer neste aparelho e abre o terminal do torneio.
 */
export function DealerAccessPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [deviceKey] = useState(() => getDeviceKey())
  const [name, setName] = useState(() => getDealerName())
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [pollError, setPollError] = useState(false)
  const [phase, setPhase] = useState<Phase>(() => (code ? { kind: 'form' } : ENDED.invalidQr()))
  // Envio em andamento: o estado `submitting` só vale no próximo render, então um toque
  // duplo (ou Enter + clique) no mesmo tick mandaria dois POSTs — o ref barra o segundo
  const submittingRef = useRef(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!code || submittingRef.current) return
    const clean = normalizeName(name)
    if (!isValidName(clean)) {
      setFormError(NAME_ERROR)
      return
    }
    setFormError(null)
    submittingRef.current = true
    setSubmitting(true)
    try {
      const created = await dealerAccessApi.requestAccess(code, clean, deviceKey)
      setDealerName(clean)
      setPollError(false)
      setPhase({
        kind: 'waiting',
        requestId: created.requestId,
        name: clean,
        tournamentName: created.tournamentName,
        reopening: created.status === 'Approved',
      })
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      const message = responseMessage(err)
      const planLimit = planLimitFromError(err)
      if (planLimit) {
        setPhase(ENDED.planLocked(planLimit.requiredPlan, planLimit.message))
      } else if (status === 429) {
        setFormError('Muitas tentativas seguidas. Espere um minuto e tente de novo.')
      } else if (status === 400) {
        if (message?.startsWith('QR do dealer inválido')) setPhase(ENDED.invalidQr())
        else if (message?.startsWith('O torneio já terminou')) setPhase(ENDED.tournamentOver())
        else setFormError(message ?? 'Não foi possível pedir acesso. Tente de novo.')
      } else {
        setFormError('Sem conexão com o servidor. Tente de novo em instantes.')
      }
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  // Aguardando: consulta o pedido a cada 3 s até o organizador decidir (ou o pedido vencer)
  useEffect(() => {
    if (phase.kind !== 'waiting') return
    const { requestId } = phase
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    function schedule() {
      timer = setTimeout(() => void tick(), POLL_INTERVAL_MS)
    }

    async function tick() {
      if (cancelled) return
      // Tela apagada ou aba em segundo plano: espera voltar (visibilitychange chama na hora)
      if (document.visibilityState === 'hidden') {
        schedule()
        return
      }
      try {
        const data = await dealerAccessApi.getRequest(requestId, deviceKey)
        if (cancelled) return
        setPollError(false)
        switch (data.status) {
          case 'Pending':
            schedule()
            return
          case 'Approved':
            if (data.accessToken && data.expiresAt) {
              setDealerSession({
                accessToken: data.accessToken,
                tournamentId: data.tournamentId,
                tournamentName: data.tournamentName,
                expiresAt: data.expiresAt,
                dealerName: data.name,
                requestId: data.requestId,
                deviceKey,
              })
              navigate(dealerTerminalPath(data.tournamentId), { replace: true })
              return
            }
            // Aprovado, mas sem token: venceu, ou o pedido é de outro aparelho / torneio encerrado
            setPhase(data.expired ? ENDED.expired() : ENDED.reread())
            return
          case 'Rejected':
            setPhase(data.expired ? ENDED.expired() : ENDED.rejected())
            return
          case 'Revoked':
            setPhase(ENDED.revoked())
            return
          default:
            schedule()
        }
      } catch (err) {
        if (cancelled) return
        const status = axios.isAxiosError(err) ? err.response?.status : undefined
        if (status === 404) {
          setPhase(ENDED.notFound())
          return
        }
        // Aprovado antes de o dono cair para o Mesa: o token não sai mais (402)
        const planLimit = planLimitFromError(err)
        if (planLimit) {
          setPhase(ENDED.planLocked(planLimit.requiredPlan, planLimit.message))
          return
        }
        setPollError(true)
        schedule()
      }
    }

    function onVisible() {
      if (document.visibilityState !== 'visible') return
      if (timer) clearTimeout(timer)
      void tick()
    }

    document.addEventListener('visibilitychange', onVisible)
    void tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [phase, deviceKey, navigate])

  function backToForm() {
    setFormError(null)
    setPollError(false)
    setPhase({ kind: 'form' })
  }

  const tournamentName = phase.kind === 'waiting' ? phase.tournamentName : null

  const shell = (children: ReactNode) => (
    <div className="min-h-screen bg-bg-primary px-4 py-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-blue-soft">
            <Tablet className="h-5 w-5 text-accent-blue" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-text-primary">Terminal do dealer</h1>
            {tournamentName && <p className="truncate text-sm text-text-secondary">{tournamentName}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  )

  if (phase.kind === 'ended') {
    const Icon = ENDED_ICON[phase.icon]
    return shell(
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border-default bg-bg-secondary p-6 text-center">
        <Icon
          className={`h-12 w-12 ${
            phase.icon === 'rejected' || phase.icon === 'revoked'
              ? 'text-accent-red'
              : phase.icon === 'plan'
                ? 'text-accent-gold-deep'
                : 'text-accent-yellow'
          }`}
        />
        <p className="text-lg font-semibold text-text-primary">{phase.title}</p>
        <p className="text-text-secondary">{phase.detail}</p>
        {phase.retry && (
          <Button className="mt-2 w-full" onClick={backToForm}>
            {phase.icon === 'rejected' ? 'Tentar de novo' : 'Pedir acesso de novo'}
          </Button>
        )}
      </div>,
    )
  }

  if (phase.kind === 'waiting') {
    if (phase.reopening) {
      return shell(
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border-default bg-bg-secondary p-6 text-center">
          <LoadingSpinner size="lg" text="Abrindo o terminal do dealer…" />
          {pollError && (
            <p className="text-sm text-text-secondary">Sem conexão com o servidor. Tentando de novo…</p>
          )}
        </div>,
      )
    }
    return shell(
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border-default bg-bg-secondary p-6 text-center">
        <LoadingSpinner size="lg" />
        <div>
          <p className="text-lg font-semibold text-text-primary">Aguardando o organizador autorizar…</p>
          <p className="mt-1 text-text-secondary">
            Pedido feito como <span className="font-semibold text-text-primary">{phase.name}</span>.
          </p>
        </div>
        <p className="text-sm text-text-secondary">
          Peça ao organizador para abrir o painel do torneio: o pedido aparece lá, inclusive no celular, e vale
          por 15 minutos. Esta tela abre o terminal sozinha assim que ele autorizar.
        </p>
        {pollError && (
          <p className="text-sm text-text-secondary">Sem conexão com o servidor. Tentando de novo…</p>
        )}
        <Button variant="ghost" className="w-full" onClick={backToForm}>
          Corrigir o nome
        </Button>
      </div>,
    )
  }

  return shell(
    <form
      className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-secondary p-5"
      onSubmit={(e) => void submit(e)}
    >
      <p className="text-sm text-text-secondary">
        Informe seu nome: o organizador vê o pedido no painel do torneio e autoriza seu acesso ao terminal,
        só neste aparelho.
      </p>
      <Input
        id="dealer-name"
        label="Seu nome"
        placeholder="Como o organizador te conhece"
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          if (formError) setFormError(null)
        }}
        maxLength={NAME_MAX}
        autoComplete="name"
        autoCapitalize="words"
        autoFocus
        error={formError ?? undefined}
        helperText={formError ? undefined : `De ${NAME_MIN} a ${NAME_MAX} letras.`}
      />
      <Button type="submit" size="lg" loading={submitting}>
        Pedir acesso
      </Button>
    </form>,
  )
}

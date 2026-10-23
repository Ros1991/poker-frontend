import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import type { ReactNode } from 'react'
import { LogIn, Tv } from 'lucide-react'
import { ROUTES, pairDisplayPath } from '../../constants/routes'
import { formatPairingCode } from '../../utils/pairingCode'
import { BrandLogo } from '../../components/brand/BrandLogo'

interface DisplayPairingScreenProps {
  code: string | null
  connectionError?: boolean
}

/**
 * Porta de entrada sem login: na TV mostra o QR grande para um celular logado
 * escolher o torneio; no celular de quem só quer entrar, o botão "Entrar" vem primeiro.
 */
export function DisplayPairingScreen({ code, connectionError }: DisplayPairingScreenProps) {
  const pairUrl = code ? `${window.location.origin}${pairDisplayPath(code)}` : null
  const host = window.location.host

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0f1c] text-white">
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a0f1c] via-[#0d1529] to-[#0a1628]" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.10),transparent_60%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 lg:px-10 lg:py-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <BrandLogo variant="lockup" className="h-11 lg:h-14" />
          </div>
          <Link
            to={ROUTES.LOGIN}
            className="hidden items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-base font-semibold text-white transition-colors hover:bg-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-400/50 lg:flex"
          >
            <LogIn className="h-5 w-5" />
            Entrar
          </Link>
        </header>

        <main className="flex flex-1 flex-col gap-8 py-8 lg:flex-row lg:items-center lg:gap-16">
          {/* No celular: entrar vem primeiro */}
          <section className="flex flex-col gap-3 lg:hidden">
            <Link
              to={ROUTES.LOGIN}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-lg font-semibold text-white active:bg-blue-500"
            >
              <LogIn className="h-5 w-5" />
              Entrar
            </Link>
            <p className="text-center text-sm text-slate-400">
              Organizador, jogador ou dealer com conta: entre para ver seus torneios.
            </p>
          </section>

          <section className="flex flex-col items-center gap-5 rounded-2xl border border-white/10 bg-white/5 p-6 lg:flex-1 lg:p-10">
            <div className="flex items-center gap-2 text-slate-300">
              <Tv className="h-5 w-5 text-blue-400" />
              <span className="text-base font-medium lg:text-xl">Mostrar um torneio nesta tela</span>
            </div>
            <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-4 shadow-[0_0_60px_rgba(59,130,246,0.25)]">
              {/* Logo completa em tamanho de TV, no mesmo cartão claro do QR */}
              <BrandLogo variant="full" onLight className="h-28 lg:h-40" />
              {pairUrl ? (
                <QRCodeSVG value={pairUrl} size={320} className="h-56 w-56 lg:h-80 lg:w-80" />
              ) : (
                <div className="flex h-56 w-56 items-center justify-center text-center text-sm text-slate-500 lg:h-80 lg:w-80">
                  {connectionError ? 'Sem conexão com o servidor. Tentando de novo…' : 'Gerando código…'}
                </div>
              )}
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm uppercase tracking-[0.3em] text-slate-500">Código</span>
              <span className="font-mono text-4xl font-bold tracking-[0.2em] text-white lg:text-6xl">
                {code ? formatPairingCode(code) : '——— ———'}
              </span>
            </div>
          </section>

          <section className="flex flex-col gap-5 lg:flex-1">
            <h1 className="text-2xl font-bold lg:text-4xl">Como usar na TV</h1>
            <ol className="flex flex-col gap-4">
              <Step n={1}>
                No celular, abra a câmera e aponte para o QR.
                <span className="block text-slate-400">
                  Sem câmera? Acesse <span className="font-semibold text-slate-200">{host}/parear</span> e
                  digite o código.
                </span>
              </Step>
              <Step n={2}>
                Entre com a sua conta, se o celular pedir.
              </Step>
              <Step n={3}>
                Escolha o torneio. <span className="font-semibold">Esta tela troca sozinha</span> — não precisa
                mexer na TV.
              </Step>
            </ol>
            <p className="text-sm text-slate-500">
              Para trocar de torneio depois, use o QR pequeno no canto do telão.
            </p>
          </section>
        </main>
      </div>
    </div>
  )
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/20 font-bold text-blue-300">
        {n}
      </span>
      <span className="pt-1 text-base leading-snug text-slate-200 lg:text-xl">
        {children}
      </span>
    </li>
  )
}

import { Mail, MessageCircle } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { CONTACT_EMAIL } from '../../constants/contact'
import type { PlanName } from '../../types/plan.types'

interface PlanRequestedStepProps {
  plan: PlanName
  /** Link do WhatsApp do suporte com a mensagem pronta; null sem número configurado no build */
  whatsappUrl: string | null
  leaving: boolean
  onContinue: () => void
}

/**
 * Depois de pedir Clube/Liga nas boas-vindas (SPEC-20261023-1212): o pedido ficou registrado e o WhatsApp do suporte
 * já foi aberto com a mensagem pronta; o link fica aqui caso o navegador tenha bloqueado a janela. O plano só muda
 * quando o suporte ativar (a conta segue no Mesa).
 */
export function PlanRequestedStep({ plan, whatsappUrl, leaving, onContinue }: PlanRequestedStepProps) {
  return (
    <section
      className="rounded-xl border border-border-default bg-bg-card p-5 text-center shadow-sm sm:p-6"
      aria-labelledby="boas-vindas-pedido-titulo"
    >
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-green-soft">
        <MessageCircle className="h-7 w-7 text-accent-green-deep" aria-hidden />
      </span>
      <h1 id="boas-vindas-pedido-titulo" className="mt-4 text-2xl font-extrabold text-text-primary">
        Pedido do plano {plan} registrado
      </h1>
      {whatsappUrl ? (
        <p className="mt-2 text-sm text-text-secondary">
          Abrimos o WhatsApp do suporte com a mensagem pronta: é só enviar. Se a conversa não abriu, use o botão abaixo.
        </p>
      ) : (
        <p className="mt-2 text-sm text-text-secondary">
          Escreva para{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center gap-1 font-medium text-accent-blue underline">
            <Mail className="h-3.5 w-3.5" aria-hidden />
            {CONTACT_EMAIL}
          </a>{' '}
          pedindo o plano {plan}.
        </p>
      )}
      <p className="mt-3 text-sm text-text-secondary">
        Enquanto o suporte ativa o {plan}, sua conta segue no Mesa (grátis). Nada se perde na troca.
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-accent-green-deep px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-green-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green focus-visible:ring-offset-2 sm:w-auto"
          >
            <MessageCircle className="h-4 w-4" aria-hidden /> Abrir o WhatsApp do suporte
          </a>
        )}
        <Button type="button" onClick={onContinue} loading={leaving} className="w-full sm:w-auto">
          Continuar
        </Button>
      </div>
    </section>
  )
}

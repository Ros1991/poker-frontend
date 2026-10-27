import { Mail, MessageCircle } from 'lucide-react'
import { CONTACT_EMAIL, supportWhatsAppUrl } from '../../../constants/contact'
import { MANUAL_INDEX } from '../manual.content'

const LINK =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border-input bg-bg-card px-4 text-sm font-semibold text-text-primary hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue'

/** "Ficou alguma dúvida?" — WhatsApp do suporte (quando o build tem o número) e e-mail de contato. */
export function ManualHelp() {
  const whatsapp = supportWhatsAppUrl(MANUAL_INDEX.helpMessage)
  return (
    <section aria-labelledby="manual-ajuda" className="rounded-2xl border border-border-default bg-bg-card p-5 sm:p-6">
      <h2 id="manual-ajuda" className="text-lg font-extrabold text-text-primary">
        {MANUAL_INDEX.helpTitle}
      </h2>
      <p className="mt-1 text-base text-text-secondary">{MANUAL_INDEX.helpText}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={LINK}>
            <MessageCircle className="h-4 w-4 text-accent-green-deep" aria-hidden="true" />
            {MANUAL_INDEX.helpWhatsApp}
          </a>
        )}
        <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
          <Mail className="h-4 w-4 text-accent-blue" aria-hidden="true" />
          {MANUAL_INDEX.helpEmail}
        </a>
      </div>
    </section>
  )
}

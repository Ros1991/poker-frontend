import { Tv } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import { FINAL_CTA } from '../landing.content'
import { accountLink } from './accountLink'
import { TEXT_LINK, linkButton } from './linkStyles'

/** Seção 7 (parte 1) — chamada final com os mesmos botões do topo: Entrar e Abrir o Telão da TV, e o Criar conta. */
export function FinalCta() {
  const account = accountLink()
  return (
    <section aria-labelledby="landing-chamada-final" className="bg-bg-primary">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16 lg:px-8">
        <div className="rounded-2xl border border-border-default bg-accent-blue-soft px-5 py-10 text-center sm:px-10">
          <h2 id="landing-chamada-final" className="text-2xl font-extrabold text-text-primary sm:text-3xl">
            {FINAL_CTA.title}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-text-secondary">{FINAL_CTA.text}</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <a href={account.href} className={linkButton('primary', 'lg')}>
              <account.Icon className="h-5 w-5" aria-hidden="true" />
              {FINAL_CTA.login}
            </a>
            <a href={ROUTES.TV} className={linkButton('gold', 'lg')}>
              <Tv className="h-5 w-5" aria-hidden="true" />
              {FINAL_CTA.tv}
            </a>
          </div>
          <p className="mt-4 text-sm text-text-secondary">
            {FINAL_CTA.signupQuestion}{' '}
            <a href={ROUTES.REGISTER} className={TEXT_LINK}>
              {FINAL_CTA.signup}
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}

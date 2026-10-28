import { Tv } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import { HERO } from '../landing.content'
import { HERO_IMAGE_SIZES, LANDING_IMAGES } from '../landingImages'
import { accountLink } from './accountLink'
import { TvFrame } from './DeviceFrames'
import { TEXT_LINK, linkButton } from './linkStyles'

/**
 * Seção 1 — topo: proposta, Entrar / Abrir o Telão da TV, "Grátis para começar" e o telão real numa TV. Logado, o
 * "Entrar" vira "Abrir painel" e o convite para criar conta some.
 */
export function Hero() {
  const account = accountLink()
  return (
    <section aria-labelledby="landing-topo" className="bg-bg-primary">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:py-14 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8 lg:py-20">
        <div>
          <h1
            id="landing-topo"
            className="text-[2rem] font-black leading-[1.15] text-text-primary sm:text-5xl sm:leading-[1.1]"
          >
            {HERO.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-text-secondary">{HERO.text}</p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href={account.href} className={linkButton('primary', 'lg')}>
              <account.Icon className="h-5 w-5" aria-hidden="true" />
              {account.loggedIn ? HERO.panel : HERO.login}
            </a>
            <a href={ROUTES.TV} className={linkButton('gold', 'lg')}>
              <Tv className="h-5 w-5" aria-hidden="true" />
              {HERO.tv}
            </a>
          </div>

          {!account.loggedIn && (
            <p className="mt-4 text-sm text-text-secondary">
              <strong className="font-bold text-text-primary">{HERO.free}</strong> {HERO.signupQuestion}{' '}
              <a href={ROUTES.REGISTER} className={TEXT_LINK}>
                {HERO.signup}
              </a>
            </p>
          )}
          <p className="mt-3 flex items-start gap-2 text-sm text-text-secondary">
            <Tv className="mt-0.5 h-4 w-4 shrink-0 text-accent-blue" aria-hidden="true" />
            <span>{HERO.tvTip}</span>
          </p>
        </div>

        <TvFrame
          image={LANDING_IMAGES.telaoPareado}
          alt={HERO.imageAlt}
          sizes={HERO_IMAGE_SIZES}
          priority
        />
      </div>
    </section>
  )
}

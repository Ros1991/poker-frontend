import { Badge } from '../../../components/ui/Badge'
import { requiredPlanFor } from '../../../components/plan/planUtils'
import { usePlanCatalog } from '../../../hooks/usePlanCatalog'
import { cn } from '../../../utils/cn'
import { HOW_IT_WORKS } from '../landing.content'
import { LANDING_IMAGES } from '../landingImages'
import { PhoneFrame, TvFrame } from './DeviceFrames'

/**
 * Seção 3 — como funciona, em 4 blocos com imagem real: telão sem login → terminal do dealer no celular → PIX
 * conferido → ranking público no WhatsApp. Nos recursos pagos, o selo "A partir do <plano>" sai do catálogo.
 */
export function HowItWorks() {
  const { plans } = usePlanCatalog()

  return (
    <section aria-labelledby="landing-como-funciona" className="bg-bg-primary">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16 lg:px-8">
        <div className="max-w-2xl">
          <h2 id="landing-como-funciona" className="text-2xl font-extrabold text-text-primary sm:text-3xl">
            {HOW_IT_WORKS.title}
          </h2>
          <p className="mt-3 text-base text-text-secondary">{HOW_IT_WORKS.text}</p>
        </div>

        <ol className="mt-10 space-y-14 lg:space-y-20">
          {HOW_IT_WORKS.blocks.map((block, index) => {
            const plan = block.feature ? requiredPlanFor(block.feature, plans) : null
            const image = LANDING_IMAGES[block.image]
            return (
              <li key={block.title} className="grid items-center gap-6 lg:grid-cols-2 lg:gap-12">
                <div className={cn(index % 2 === 1 && 'lg:order-2')}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-blue-soft font-bold text-accent-blue tabular-nums"
                    >
                      {index + 1}
                    </span>
                    <h3 className="text-xl font-extrabold text-text-primary sm:text-2xl">{block.title}</h3>
                    {plan && <Badge color="gold">{`${HOW_IT_WORKS.planPrefix} ${plan}`}</Badge>}
                  </div>
                  <p className="mt-3 text-base leading-relaxed text-text-secondary">{block.text}</p>
                </div>
                {block.frame === 'tv' ? (
                  <TvFrame image={image} alt={block.imageAlt} sizes="(min-width: 1024px) 34rem, calc(100vw - 3rem)" />
                ) : (
                  <PhoneFrame image={image} alt={block.imageAlt} sizes="15rem" />
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

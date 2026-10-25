import { usePageMeta } from '../../hooks/usePageMeta'
import { LEGAL_PAGE } from '../landing/landing.content'
import { LandingFooter } from '../landing/sections/LandingFooter'
import { LandingHeader } from '../landing/sections/LandingHeader'
import { LEGAL_INFO, splitLegalText } from './legal.content'
import type { LegalBlock, LegalDocument } from './legal.content'

const LINK = 'font-medium text-accent-blue underline underline-offset-4 break-words hover:text-accent-blue-hover'

/** Parágrafo/item com e-mails e URLs `https://` como link (mesma regra das páginas estáticas). */
function RichText({ text }: { text: string }) {
  return (
    <>
      {splitLegalText(text).map((part, i) =>
        part.href ? (
          <a
            key={i}
            href={part.href}
            className={LINK}
            {...(part.href.startsWith('https://') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  )
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === 'string') {
    return (
      <p className="mt-3 leading-relaxed text-text-primary">
        <RichText text={block} />
      </p>
    )
  }
  return (
    <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-text-primary marker:text-text-secondary">
      {block.map((item) => (
        <li key={item}>
          <RichText text={item} />
        </li>
      ))}
    </ul>
  )
}

/**
 * Página de termos ou privacidade na SPA (SPEC-20261023-1207), com o cabeçalho e o rodapé da landing. O conteúdo vem
 * de `legal.content.ts` — o mesmo das versões estáticas `public/termos.html` e `public/privacidade.html`.
 */
export function LegalDocumentView({ doc }: { doc: LegalDocument }) {
  usePageMeta({ title: doc.pageTitle, description: doc.description, path: doc.path })

  return (
    <div className="min-h-dvh overflow-x-clip bg-bg-primary text-text-primary">
      <LandingHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14 lg:px-8">
        <article>
          <h1 className="text-3xl font-black text-text-primary sm:text-4xl">{doc.title}</h1>
          <p className="mt-2 text-sm text-text-secondary">
            {LEGAL_PAGE.updatedPrefix} {LEGAL_INFO.updatedAt}
          </p>
          {doc.intro.map((p) => (
            <Block key={p} block={p} />
          ))}

          <nav
            aria-label={LEGAL_PAGE.summaryLabel}
            className="mt-8 rounded-xl border border-border-default bg-bg-card p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              {LEGAL_PAGE.summaryLabel}
            </p>
            <ol className="mt-3 space-y-1 text-sm">
              {doc.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className={LINK}>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {doc.sections.map((section) => (
            <section key={section.id} aria-labelledby={section.id} className="mt-10">
              <h2 id={section.id} className="scroll-mt-6 text-xl font-extrabold text-text-primary sm:text-2xl">
                {section.title}
              </h2>
              {section.blocks.map((block, i) => (
                <Block key={i} block={block} />
              ))}
            </section>
          ))}
        </article>
      </main>
      <LandingFooter />
    </div>
  )
}

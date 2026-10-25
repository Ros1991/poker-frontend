/**
 * Título, descrição e endereço canônico de uma página pública (SPEC-20261023-1207).
 *
 * API estável:
 * - `usePageMeta({ title, description, path })` — enquanto a página estiver montada:
 *   - `document.title = title`;
 *   - `<meta name="description" content={description}>` (cria a tag se não existir);
 *   - `<link rel="canonical" href={PUBLIC_SITE_URL + path}>` (sempre o domínio oficial, nunca o de quem abriu —
 *     www, domínio antigo do Railway ou localhost apontam para a mesma URL canônica).
 *   Ao desmontar, devolve os valores que estavam antes (os do index.html ou da página anterior).
 *
 * - `useCanonical(path | null)` — só o `<link rel="canonical">` (mesma regra e mesma restauração), para páginas que
 *   já cuidam do próprio título. `null` (dados ainda carregando) não mexe em nada.
 *
 * Usado pela landing (`/`), `/termos` e `/privacidade`. `PublicRankingPage`/`PublicPlayerPage` continuam definindo
 * o próprio `document.title` e usam `useCanonical`: o index.html traz o canonical da raiz para toda rota da SPA, e
 * sem isso o ranking público (liberado no robots.txt) seria lido pelo Google como cópia da landing.
 */
import { useEffect } from 'react'
import { PUBLIC_SITE_URL } from '../constants/contact'

export interface PageMeta {
  title: string
  description: string
  /** Caminho a partir da raiz, ex.: "/" ou "/termos" */
  path: string
}

/** URL canônica no domínio oficial: "/" → "https://pokerdagalera.com.br/". */
export function canonicalUrl(path: string): string {
  return `${PUBLIC_SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

function ensureElement<T extends HTMLElement>(selector: string, create: () => T): { el: T; created: boolean } {
  const existing = document.head.querySelector<T>(selector)
  if (existing) return { el: existing, created: false }
  const el = create()
  document.head.appendChild(el)
  return { el, created: true }
}

export function useCanonical(path: string | null) {
  useEffect(() => {
    if (path === null) return
    const link = ensureElement('link[rel="canonical"]', () => {
      const l = document.createElement('link')
      l.rel = 'canonical'
      return l
    })
    const previousCanonical = link.el.getAttribute('href')
    link.el.setAttribute('href', canonicalUrl(path))
    return () => {
      if (link.created) link.el.remove()
      else if (previousCanonical !== null) link.el.setAttribute('href', previousCanonical)
    }
  }, [path])
}

export function usePageMeta({ title, description, path }: PageMeta) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = title

    const meta = ensureElement('meta[name="description"]', () => {
      const m = document.createElement('meta')
      m.name = 'description'
      return m
    })
    const previousDescription = meta.el.getAttribute('content')
    meta.el.setAttribute('content', description)

    const link = ensureElement('link[rel="canonical"]', () => {
      const l = document.createElement('link')
      l.rel = 'canonical'
      return l
    })
    const previousCanonical = link.el.getAttribute('href')
    link.el.setAttribute('href', canonicalUrl(path))

    return () => {
      document.title = previousTitle
      if (meta.created) meta.el.remove()
      else if (previousDescription !== null) meta.el.setAttribute('content', previousDescription)
      if (link.created) link.el.remove()
      else if (previousCanonical !== null) link.el.setAttribute('href', previousCanonical)
    }
  }, [title, description, path])
}

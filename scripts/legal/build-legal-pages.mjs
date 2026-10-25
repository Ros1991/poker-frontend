/**
 * Gera as versões ESTÁTICAS dos termos de uso e da política de privacidade (SPEC-20261023-1207):
 *   public/termos.html e public/privacidade.html — servidas pelo nginx em `location = /termos` e `= /privacidade`
 *   para quem lê sem JavaScript (robô da verificação de marca do Google, pré-visualizações, leitores simples).
 *
 * Fonte única: src/pages/legal/legal.content.ts (o mesmo texto das páginas da SPA) e os rótulos do cabeçalho/rodapé
 * de src/pages/landing/landing.content.ts. O Node lê os .ts direto (remoção de tipos nativa do Node 22.18+).
 *
 * Uso (em poker-frontend/):
 *   node scripts/legal/build-legal-pages.mjs           → (re)escreve os dois arquivos (só se o conteúdo mudou)
 *   node scripts/legal/build-legal-pages.mjs --check   → não escreve; sai com 1 se algum estiver desatualizado
 * Determinístico: o ano do rodapé é o da data de atualização dos documentos, não o do relógio.
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND = path.resolve(here, '..', '..')
const PUBLIC = path.join(FRONTEND, 'public')

const legal = await import(pathToFileURL(path.join(FRONTEND, 'src/pages/legal/legal.content.ts')).href)
const landing = await import(pathToFileURL(path.join(FRONTEND, 'src/pages/landing/landing.content.ts')).href)
const { LEGAL_DOCS, LEGAL_INFO, splitLegalText } = legal
const { FOOTER, HEADER, LEGAL_PAGE, PRICING_ANCHOR } = landing

// Paleta do tema claro (= tokens de src/styles/globals.css; página estática não lê o CSS do app)
const C = {
  bg: '#F5F7FA',
  card: '#FFFFFF',
  border: '#E1E6EE',
  borderInput: '#7D8BA0',
  text: '#1B2E4B',
  textSecondary: '#5A6B82',
  blue: '#1E5AA8',
  blueHover: '#174A8B',
  blueSoft: '#E4EEF9',
  gold: '#F0B340',
  goldHover: '#D99A25',
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function rich(text) {
  return splitLegalText(text)
    .map((p) => {
      if (!p.href) return esc(p.text)
      const external = p.href.startsWith('https://') ? ' target="_blank" rel="noopener noreferrer"' : ''
      return `<a href="${esc(p.href)}"${external}>${esc(p.text)}</a>`
    })
    .join('')
}

function block(b) {
  if (typeof b === 'string') return `<p>${rich(b)}</p>`
  return `<ul>${b.map((item) => `<li>${rich(item)}</li>`).join('')}</ul>`
}

const CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:${C.bg};color:${C.text};font-family:'Inter Variable',Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
h1,h2{font-family:'Nunito Variable',Nunito,'Inter Variable',Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;line-height:1.25;color:${C.text}}
h1{font-size:1.875rem;font-weight:900;margin:0}
h2{font-size:1.25rem;font-weight:800;margin:2.5rem 0 0;scroll-margin-top:1.5rem}
a{color:${C.blue};text-underline-offset:4px;overflow-wrap:anywhere}
a:hover{color:${C.blueHover}}
a:focus-visible{outline:2px solid ${C.blue};outline-offset:2px;border-radius:2px}
.wrap{max-width:48rem;margin:0 auto;padding:0 1rem}
.skip{position:absolute;left:-9999px}
.skip:focus{left:1rem;top:1rem;z-index:10;background:${C.card};padding:.75rem 1rem;border-radius:.5rem}
header{background:${C.card};border-bottom:1px solid ${C.border}}
.bar{display:flex;align-items:center;justify-content:space-between;gap:.75rem;max-width:72rem;padding-top:.5rem;padding-bottom:.5rem}
.logo{display:inline-flex}
.logo img{height:3.5rem;width:auto;display:block}
.nav{display:flex;gap:.5rem}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:.5rem 1rem;border-radius:.5rem;font-weight:600;font-size:.875rem;text-decoration:none}
.btn.sec{background:${C.card};color:${C.text};border:1px solid ${C.borderInput}}
.btn.sec:hover{background:#EDF1F6;color:${C.text}}
.btn.gold{background:${C.gold};color:${C.text}}
.btn.gold:hover{background:${C.goldHover};color:${C.text}}
main.wrap{padding-top:2.5rem;padding-bottom:3.5rem}
.updated{margin:.5rem 0 0;font-size:.875rem;color:${C.textSecondary}}
p,li{margin:.75rem 0 0}
ul{margin:.75rem 0 0;padding-left:1.25rem}
li::marker{color:${C.textSecondary}}
.toc{margin-top:2rem;background:${C.card};border:1px solid ${C.border};border-radius:.75rem;padding:1.25rem}
.toc p{margin:0;font-size:.75rem;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:${C.textSecondary}}
.toc ol{list-style:none;margin:.75rem 0 0;padding-left:0;font-size:.875rem}
.toc li{margin:.25rem 0 0}
footer{background:${C.card};border-top:1px solid ${C.border}}
.foot{max-width:72rem;padding-top:2rem;padding-bottom:2rem;display:flex;flex-direction:column;gap:1rem}
.foot ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;column-gap:1.25rem}
.foot li{margin:0}
.foot ul a{display:inline-flex;min-height:44px;min-width:44px;align-items:center;justify-content:center;font-size:.875rem;font-weight:600;color:${C.text};text-decoration:none}
.foot ul a:hover{color:${C.blue};text-decoration:underline}
.foot p{margin:0;font-size:.875rem;color:${C.textSecondary}}
.foot strong{color:${C.text}}
@media (min-width:640px){h1{font-size:2.25rem}h2{font-size:1.5rem}.logo img{height:4rem}.btn{padding:.5rem 1rem}}
@media (min-width:1024px){.foot{flex-direction:row;align-items:center;justify-content:space-between}.foot .right{text-align:right}}
`.trim()

function page(doc) {
  const url = `${LEGAL_INFO.site}${doc.path}`
  const year = LEGAL_INFO.updatedAt.slice(-4)
  const toc = doc.sections.map((s) => `<li><a href="#${esc(s.id)}">${esc(s.title)}</a></li>`).join('')
  const sections = doc.sections
    .map(
      (s) =>
        `<section aria-labelledby="${esc(s.id)}"><h2 id="${esc(s.id)}">${esc(s.title)}</h2>${s.blocks.map(block).join('')}</section>`,
    )
    .join('\n')
  return `<!doctype html>
<!-- Gerado por scripts/legal/build-legal-pages.mjs a partir de src/pages/legal/legal.content.ts (SPEC-20261023-1207). Não edite à mão. -->
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(doc.pageTitle)}</title>
<meta name="description" content="${esc(doc.description)}" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="${esc(url)}" />
<meta name="theme-color" content="${C.bg}" />
<meta name="color-scheme" content="light" />
<link rel="icon" href="/favicon.ico" sizes="48x48" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Poker da Galera" />
<meta property="og:locale" content="pt_BR" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:title" content="${esc(doc.pageTitle)}" />
<meta property="og:description" content="${esc(doc.description)}" />
<meta property="og:image" content="${esc(LEGAL_INFO.site)}/og-image.png" />
<style>${CSS}</style>
</head>
<body>
<!-- email_off: o Cloudflare (Email Address Obfuscation) troca e-mails por um link que só abre com JavaScript;
     estas páginas existem justamente para quem lê sem JS (robô de verificação do Google), então o contato fica em texto. -->
<!--email_off-->
<a class="skip" href="#conteudo">${esc(HEADER.skipLink)}</a>
<header><div class="wrap bar">
<a class="logo" href="/"><img src="/brand/logo-completa.png" alt="Poker da Galera" width="220" height="231" /></a>
<nav class="nav" aria-label="${esc(HEADER.navLabel)}"><a class="btn sec" href="/login">${esc(HEADER.login)}</a><a class="btn gold" href="/tv">${esc(HEADER.tvShort)}</a></nav>
</div></header>
<main id="conteudo" class="wrap"><article>
<h1>${esc(doc.title)}</h1>
<p class="updated">${esc(LEGAL_PAGE.updatedPrefix)} ${esc(LEGAL_INFO.updatedAt)}</p>
${doc.intro.map(block).join('\n')}
<nav class="toc" aria-label="${esc(LEGAL_PAGE.summaryLabel)}"><p>${esc(LEGAL_PAGE.summaryLabel)}</p><ol>${toc}</ol></nav>
${sections}
</article></main>
<footer><div class="wrap foot">
<nav aria-label="${esc(FOOTER.navLabel)}"><ul>
<li><a href="/login">${esc(FOOTER.links.login)}</a></li>
<li><a href="/tv">${esc(FOOTER.links.tv)}</a></li>
<li><a href="/#${esc(PRICING_ANCHOR)}">${esc(FOOTER.links.pricing)}</a></li>
<li><a href="/termos">${esc(FOOTER.links.terms)}</a></li>
<li><a href="/privacidade">${esc(FOOTER.links.privacy)}</a></li>
<li><a href="mailto:${esc(LEGAL_INFO.email)}">${esc(FOOTER.links.contact)}</a></li>
</ul></nav>
<div class="right"><p><strong>${esc(FOOTER.tvLine)}</strong></p><p>${esc(FOOTER.copyright(Number(year)))} · <a href="mailto:${esc(LEGAL_INFO.email)}">${esc(LEGAL_INFO.email)}</a></p></div>
</div></footer>
<!--/email_off-->
</body>
</html>
`
}

const check = process.argv.includes('--check')
let stale = 0
for (const doc of LEGAL_DOCS) {
  const file = path.join(PUBLIC, `${doc.path.slice(1)}.html`)
  const html = page(doc)
  let current = null
  try {
    current = await readFile(file, 'utf8')
  } catch {
    current = null
  }
  if (current === html) {
    console.log(`${path.relative(FRONTEND, file)}: em dia`)
    continue
  }
  if (check) {
    stale++
    console.log(`${path.relative(FRONTEND, file)}: DESATUALIZADO (rode node scripts/legal/build-legal-pages.mjs)`)
  } else {
    await writeFile(file, html)
    console.log(`${path.relative(FRONTEND, file)}: gerado`)
  }
}
if (stale) process.exit(1)

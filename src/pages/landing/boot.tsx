/**
 * Entrada do `index.html` (SPEC-20261023-1207). Decide, antes de baixar o app, se a visita é só da landing:
 * - visitante novo em `/` (sem sessão de login, de dealer ou de TV) → `standalone.tsx`: só a landing, com React,
 *   React Query e o cliente HTTP — sem o roteador e sem o pacote do painel, do telão e do terminal;
 * - `/manual` e `/manual/<módulo>`, com ou sem sessão → `pages/manual/standaloneManual.tsx`: só o manual de uso
 *   (SPEC-20261026-1910), também sem o roteador e sem o pacote do painel;
 * - qualquer outro caso → `src/main.tsx`, o app completo de sempre (o `RootGate` decide `/` como sempre).
 * Os links da landing são `<a href>` comuns: ao sair dela, a página de destino abre com o app completo.
 *
 * O `tv.html` (servido em `/tv`) continua apontando direto para `src/main.tsx`.
 */
import '../../styles/globals.css'
import { isLandingVisit } from './landingVisit'
import { HERO_IMAGE_SIZES, LANDING_IMAGES } from './landingImages'
import { isManualPath } from '../manual/manualPath'

/**
 * A imagem do topo (o telão numa TV) é o maior elemento da primeira tela: começa a baixar já, em paralelo com o
 * JavaScript da landing (mesmos srcset/sizes do <img> do Hero, então o navegador reaproveita o download).
 */
function preloadHeroImage() {
  const image = LANDING_IMAGES.telaoPareado
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.setAttribute('imagesrcset', image.srcSet)
  link.setAttribute('imagesizes', HERO_IMAGE_SIZES)
  link.setAttribute('fetchpriority', 'high')
  document.head.appendChild(link)
}

function showLoadError() {
  const root = document.getElementById('root')
  if (!root || root.childElementCount > 0) return
  const box = document.createElement('div')
  box.setAttribute('role', 'alert')
  box.className = 'flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg-primary p-6 text-center text-text-primary'
  const text = document.createElement('p')
  text.textContent = 'Não foi possível carregar o site. Confira a conexão e tente de novo.'
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'Tentar de novo'
  button.className = 'min-h-[44px] rounded-lg bg-accent-blue px-5 font-semibold text-white'
  button.addEventListener('click', () => window.location.reload())
  box.append(text, button)
  root.append(box)
}

// Os import() ficam em ramos de formato diferente (os da landing e do manual com .then e funções de nomes diferentes):
// se o minificador os juntasse numa expressão só, o Vite pré-carregaria as dependências do app completo também na
// visita da landing ou do manual.
if (isLandingVisit()) {
  preloadHeroImage()
  import('./standalone')
    .then((m) => m.mountStandaloneLanding())
    .catch(showLoadError)
} else if (isManualPath()) {
  import('../manual/standaloneManual')
    .then((m) => m.mountStandaloneManual())
    .catch(showLoadError)
} else {
  import('../../main').catch(showLoadError)
}

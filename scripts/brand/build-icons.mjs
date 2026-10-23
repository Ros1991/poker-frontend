/**
 * Gera as peças da marca servidas pelo app a partir de docs/marca/ (SPEC-20261023-1202).
 *
 * Uso: node scripts/brand/build-icons.mjs   (de qualquer pasta; não faz parte do `npm run build`)
 *
 * Entradas (docs/marca/):
 *   logo-completa.png, marca-grafica.png, tipografia.png  → copiadas para public/brand/
 *   favicon-original.png (medalhão)                        → favicon.ico (48), apple-touch-icon, icon-192/512, maskable
 * Entrada (scripts/brand/favicon.svg): desenho simplificado ficha + carta → public/favicon.svg e os 16/32 do .ico
 * Saída: public/ (versionada). A geração é determinística: rodar duas vezes não altera o `git status`.
 *
 * Cor do tema (SPEC-20261023-1204, tema único claro): `BG` (= --color-bg-primary de globals.css) é a
 * fonte de `theme_color`/`background_color` do site.webmanifest e do <meta name="theme-color"> do
 * index.html — o gerador reescreve os três, então manifest e index.html não divergem mais
 * (antes o manifest tinha theme_color #1E5AA8 e o index.html #F5F7FA).
 *
 * Versionamento (cache): depois de gerar, calcula um hash curto (8 hex) do conteúdo de TODOS os
 * arquivos gerados e carimba `?v=<hash>` nas referências em index.html (favicon.ico/.svg,
 * apple-touch-icon, manifest, og:image) e nos ícones de public/site.webmanifest. Trocar a arte muda
 * a URL e fura qualquer cache (browser e borda do Cloudflare) sem depender do TTL do nginx.
 * Os arquivos só são reescritos quando o texto muda.
 *
 * Quando o designer entregar os originais, basta trocar os arquivos em docs/marca/ e rodar de novo.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const here = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND = path.resolve(here, '..', '..')
const MARCA = path.resolve(FRONTEND, '..', 'docs', 'marca')
const PUBLIC = path.join(FRONTEND, 'public')
const INDEX_HTML = path.join(FRONTEND, 'index.html')
const MANIFEST = path.join(PUBLIC, 'site.webmanifest')

const BG = '#F5F7FA' // = --color-bg-primary (globals.css): fundo dos ícones, theme_color/background_color e theme-color
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }
const PNG = { compressionLevel: 9, adaptiveFiltering: false }

/** Arquivos de public/ cuja URL recebe `?v=` (index.html e manifest). */
const VERSIONED_REFS = [
  'favicon.ico',
  'favicon.svg',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon-512-maskable.png',
  'og-image.png',
  'site.webmanifest',
]

const src = (name) => path.join(MARCA, name)
const out = (name) => path.join(PUBLIC, name)

/** Medalhão recortado (sem margem transparente) — base de todos os ícones ≥ 48 px. */
async function medallion() {
  return sharp(src('favicon-original.png')).trim().png().toBuffer()
}

async function squareIcon(input, size, { background = TRANSPARENT, flatten = false, scale = 1 } = {}) {
  const inner = Math.round(size * scale)
  let img = sharp(input).resize(inner, inner, { fit: 'contain', background, kernel: 'lanczos3' })
  if (inner !== size) {
    const pad = Math.floor((size - inner) / 2)
    img = img.extend({ top: pad, bottom: size - inner - pad, left: pad, right: size - inner - pad, background })
  }
  if (flatten) img = img.flatten({ background })
  return img.png(PNG).toBuffer()
}

async function rasterSvg(svgBuffer, size) {
  return sharp(svgBuffer, { density: 384 })
    .resize(size, size, { fit: 'contain', background: TRANSPARENT })
    .png(PNG)
    .toBuffer()
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** og-image 1200×630: logo completa à esquerda, nome e proposta à direita (sem repetir o subtítulo que já está na logo). */
async function buildOgImage() {
  const W = 1200
  const H = 630
  const logoH = 440
  const logo = await sharp(src('logo-completa.png')).resize({ height: logoH, kernel: 'lanczos3' }).png().toBuffer()
  const logoMeta = await sharp(logo).metadata()
  const logoLeft = Math.round(80 + (420 - logoMeta.width) / 2)
  const logoTop = Math.round((H - logoH) / 2)

  // Nunito se estiver instalada na máquina; senão a sans do sistema (provisório até a arte final do designer)
  const font = "Nunito, 'Segoe UI', Arial, sans-serif"
  const lines = ['Relógio de blinds e telão na TV', 'Inscrições, rebuys e prêmios', 'Ranking da temporada']
  const bullets = lines
    .map(
      (t, i) =>
        `<circle cx="572" cy="${318 + i * 54}" r="6" fill="#2E9E5B"/>` +
        `<text x="594" y="${328 + i * 54}" font-family="${font}" font-weight="600" font-size="30" fill="#5A6B82">${escapeXml(t)}</text>`,
    )
    .join('\n')
  const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${BG}"/>
    <rect x="0" y="${H - 14}" width="${W}" height="14" fill="#1E5AA8"/>
    <rect x="0" y="${H - 14}" width="400" height="14" fill="#F0B340"/>
    <text x="560" y="225" font-family="${font}" font-weight="900" font-size="78" fill="#1E5AA8">Poker da Galera</text>
    <rect x="564" y="248" width="140" height="8" rx="4" fill="#F0B340"/>
    ${bullets}
    <text x="560" y="560" font-family="${font}" font-weight="800" font-size="26" fill="#1E5AA8">pokerdagalera.com.br</text>
  </svg>`

  return sharp(Buffer.from(textSvg))
    .composite([{ input: logo, left: logoLeft, top: logoTop }])
    .png(PNG)
    .toBuffer()
}

/**
 * Hash curto (8 hex) do conteúdo dos arquivos gerados, em ordem fixa de nome.
 * Mesmo algoritmo é reproduzido pelo script de verificação (brand-check.js).
 */
export function versionOf(outputs) {
  const h = createHash('sha256')
  for (const name of [...outputs.keys()].sort()) {
    h.update(name)
    h.update('\0')
    h.update(outputs.get(name))
    h.update('\0')
  }
  return h.digest('hex').slice(0, 8)
}

/** Carimba/atualiza `?v=<version>` em todas as referências aos arquivos de VERSIONED_REFS. */
export function stampVersion(text, version) {
  const names = VERSIONED_REFS.map((n) => n.replace(/\./g, '\\.')).join('|')
  const re = new RegExp(`(/(?:${names}))(\\?v=[0-9a-f]+)?(?=["'])`, 'g')
  return text.replace(re, `$1?v=${version}`)
}

/** Alinha theme_color e background_color do site.webmanifest com BG (tema único claro). */
export function syncManifestColors(text) {
  return text.replace(/("(?:theme_color|background_color)"\s*:\s*)"[^"]*"/g, `$1"${BG}"`)
}

/** Alinha o <meta name="theme-color"> do index.html com BG. */
export function syncHtmlThemeColor(text) {
  return text.replace(/(<meta\s+name="theme-color"\s+content=")[^"]*(")/, `$1${BG}$2`)
}

/** Reescreve o arquivo só se o texto mudou (mantém mtime/git status estáveis). */
async function rewriteIfChanged(file, transform) {
  const before = await readFile(file, 'utf8')
  const after = transform(before)
  if (after !== before) await writeFile(file, after)
  return after !== before
}

async function main() {
  await mkdir(path.join(PUBLIC, 'brand'), { recursive: true })

  /** nome relativo a public/ → conteúdo gerado */
  const outputs = new Map()

  // 1. Peças de uso em tela (cópia fiel)
  for (const name of ['logo-completa.png', 'marca-grafica.png', 'tipografia.png']) {
    outputs.set(`brand/${name}`, await readFile(src(name)))
  }

  // 2. favicon.svg (desenho simplificado) + favicon.ico (16/32 do svg, 48 do medalhão)
  const svg = await readFile(path.join(here, 'favicon.svg'))
  outputs.set('favicon.svg', svg)
  const med = await medallion()
  outputs.set('favicon.ico', await pngToIco([await rasterSvg(svg, 16), await rasterSvg(svg, 32), await squareIcon(med, 48)]))

  // 3. Ícones do medalhão
  outputs.set('apple-touch-icon.png', await squareIcon(med, 180, { background: BG, flatten: true }))
  outputs.set('icon-192.png', await squareIcon(med, 192))
  outputs.set('icon-512.png', await squareIcon(med, 512))
  outputs.set('icon-512-maskable.png', await squareIcon(med, 512, { background: BG, flatten: true, scale: 0.8 }))

  // 4. og-image
  outputs.set('og-image.png', await buildOgImage())

  for (const [name, buf] of outputs) await writeFile(out(name), buf)

  // 5. Versão das referências (?v=) e cor do tema em index.html e site.webmanifest
  const version = versionOf(outputs)
  const changedHtml = await rewriteIfChanged(INDEX_HTML, (t) => stampVersion(syncHtmlThemeColor(t), version))
  const changedManifest = await rewriteIfChanged(MANIFEST, (t) => stampVersion(syncManifestColors(t), version))

  console.log('Marca gerada em', PUBLIC)
  console.log(
    `Versão dos ícones: ${version}` +
      (changedHtml || changedManifest
        ? ` (atualizada em ${[changedHtml && 'index.html', changedManifest && 'site.webmanifest'].filter(Boolean).join(' e ')})`
        : ' (index.html e site.webmanifest já estavam em dia)'),
  )
}

// Executa só quando chamado direto (brand-check.js importa versionOf/stampVersion sem gerar nada)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

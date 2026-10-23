/**
 * Guarda-corpo do tema claro (SPEC-20261023-1204): falha (exit 1) se voltar cor crua fora dos
 * tokens de src/styles/globals.css.
 *
 * Uso:
 *   npm run lint:colors                                  (varre src/**\/*.{ts,tsx}; também roda em `npm run lint`)
 *   node scripts/check-raw-colors.mjs src/pages/x.tsx …  (só os arquivos informados)
 *
 * globals.css fica de fora: é a fonte dos tokens. Acusa, com arquivo:linha:
 *   1. classes de cor da paleta padrão do Tailwind — bg-slate-400, text-red-500, border-blue-500/30,
 *      ring-/from-/to-/via-/fill-/stroke-/outline-/divide-/placeholder-/shadow-…
 *   2. bg|text|border-white|black, com ou sem opacidade (bg-white/5, border-white/10, bg-black/60)
 *   3. hex inline (#0f172a, #fff) em classe, estilo ou string
 *   4. token inexistente — classe com cara de token (text-accent-x-deep, bg-bg-zebra…) sem o
 *      `--color-…` correspondente em globals.css: o Tailwind não gera a classe e a cor some em silêncio
 *   5. cor literal em classe arbitrária — rgb()/rgba()/hsl()/hwb()/lab()/lch()/oklab()/oklch()/color()
 *      em qualquer `utilitário-[…]` (bg-[rgb(…)], text-[hsl(…)], shadow-[0_0_8px_rgba(…)]), qualquer
 *      dica de tipo `-[color:…]`, nome de cor CSS num utilitário de cor (bg-[red], border-t-[white],
 *      shadow-[0_0_0_1px_navy]) e propriedade arbitrária de cor ([color:red], [background:rgb(…)])
 *   6. cor literal em estilo inline — dentro de `style={…}` (inclusive em ternários), as chaves de cor
 *      (color, background, backgroundColor, backgroundImage, border*, border*Color, outline*, fill,
 *      stroke, caretColor, accentColor, textDecoration*, boxShadow, textShadow…) e custom properties
 *      ('--x') com função de cor ou nome de cor. As chaves que só existem em CSS (…Color) e as custom
 *      properties ('--x') são verificadas em QUALQUER objeto do arquivo (ex.: `const s = {…} as
 *      CSSProperties` passado por `style={s}`). `var(--color-…)` é o caminho permitido; o hex já cai
 *      no item 3; `transparent`, `currentColor`, `inherit` e `none` passam.
 *   7. atributo de cor SVG/QR com literal — fill/stroke/stopColor/floodColor/lightingColor/bgColor/
 *      fgColor="red" ou "rgb(…)" (`none`, `currentColor` e expressões passam). `color=` não entra: é
 *      a prop do <Badge color="green">, que já é chave de token.
 *
 * Nome de cor CSS só conta como palavra solta (separada por espaço, vírgula, parênteses, `/` ou `_`):
 * `border-accent-red` e `var(--color-accent-red)` não são "red".
 *
 * Aceito sem allowlist (regras de contexto):
 *   - `text-white` com um preenchimento sólido escuro (bg-accent-blue, bg-accent-red-deep,
 *     bg-text-primary…) na MESMA linha e no MESMO estado: é o texto dos botões cheios. O preenchimento
 *     que libera um `text-white` base precisa estar SEM prefixo de variante — `hover:bg-accent-blue`,
 *     `active:`, `focus:`, `group-hover:`, `md:`… não liberam, porque fora daquele estado o branco fica
 *     sobre o fundo claro. Um `text-white` com variante (`hover:text-white`) é aceito com o
 *     preenchimento base ou com o da MESMA variante (`hover:bg-accent-blue hover:text-white`).
 *     Fora disso é cor crua — e sobre dourado ou laranja base o branco não passa AA: o texto ali é
 *     text-text-primary.
 *   - `bg-white` (puro, sem opacidade) até 5 linhas antes de um `<QRCodeSVG`: a câmera precisa de
 *     branco puro atrás do QR. Em qualquer outro lugar use bg-bg-card.
 *
 * Allowlist explícita (ALLOW_LINES por arquivo:linha, ALLOW_TOKENS por token): cada entrada com motivo.
 * Avisos (não falham): rgba()/hsl() fora de classe/estilo (ex.: canvas) e textShadow.
 * Sem dependências: só Node.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND = path.resolve(here, '..')
const SRC = path.join(FRONTEND, 'src')
const GLOBALS = path.join(SRC, 'styles', 'globals.css')

/** 'caminho/relativo/a/src.tsx:linha' → motivo. */
const ALLOW_LINES = new Map([
  // ['pages/exemplo/Arquivo.tsx:123', 'motivo'],
])

/** token exato → motivo (vale em qualquer arquivo). */
const ALLOW_TOKENS = new Map([
  // ['bg-white', 'motivo'],
])

const TAILWIND_PALETTE =
  /\b(bg|text|border|ring|from|to|via|fill|stroke|outline|divide|placeholder|shadow)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g
const WHITE_BLACK = /\b(bg|text|border)-(white|black)(?:\/[^\s"'`)}\]]+|(?![\w-]))/g
const HEX = /#[0-9a-fA-F]{3,8}\b/g
const TOKEN_CLASS =
  /\b(bg|text|border|ring|ring-offset|from|to|via|fill|stroke|outline|divide|placeholder|shadow|decoration)-((?:bg|text|border|accent|brand)-[a-z0-9]+(?:-[a-z0-9]+)*)(?:\/[\d.]+)?\b/g
/** Preenchimentos sólidos escuros em que texto branco passa AA (dourado, amarelo e laranja base ficam de fora). */
const SOLID_FILL =
  /\b(?:bg-accent-(?:blue|blue-hover|blue-deep|green|green-hover|green-deep|red|red-hover|red-deep|purple|purple-deep|orange-deep|teal|indigo)|bg-text-primary|bg-text-secondary|bg-brand-blue|bg-brand-blue-hover|bg-brand-navy)(?![\w/-])/g
const SOFT_WARNINGS = /\brgba?\(|\bhsla?\(|textShadow/
const QR_WINDOW = 5

/** Caracteres que separam classes numa linha de código (espaço, aspas, crase, chaves, parênteses, vírgula). */
const CLASS_SEP = /[\s"'`{}(),;]/

/** Funções de cor do CSS (color-mix(…) com var() passa: só `color(` exato conta). */
const COLOR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i

/** Os 148 nomes de cor do CSS Color 4 (transparent/currentColor ficam de fora de propósito). */
const CSS_NAMED_COLORS = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet ' +
    'brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue ' +
    'darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange ' +
    'darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise ' +
    'darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia ' +
    'gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ' +
    'ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
    'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue ' +
    'lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon ' +
    'mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue ' +
    'mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin ' +
    'navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen ' +
    'paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red ' +
    'rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue ' +
    'slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white ' +
    'whitesmoke yellow yellowgreen'
  ).split(' '),
)

/** Utilitário com valor arbitrário: bg-[…], border-t-[…], shadow-[…], ring-offset-[…]… (m[1] = utilitário, m[2] = valor). */
const ARBITRARY_VALUE = /(?<![\w\]-])([a-z][a-z0-9-]*)-\[([^\]\s"'`]+)\]/g
/** Utilitários cujo valor arbitrário é (ou contém) uma cor — só neles o nome de cor solto reprova. */
const COLOR_UTILITY =
  /^(?:bg|text|border(?:-[xytrblse])?|ring|ring-offset|inset-ring|outline|fill|stroke|from|via|to|divide|placeholder|caret|accent|decoration|shadow|inset-shadow|drop-shadow|text-shadow)$/
/** Propriedade arbitrária do Tailwind: [color:red], [background:rgb(…)], [--x:…] (m[1] = propriedade, m[2] = valor). */
const ARBITRARY_PROPERTY = /(?<![\w-])\[([a-z-]+):([^\]\s"'`]+)\]/g
const COLOR_CSS_PROPERTY =
  /^(?:color|background(?:-color|-image)?|border(?:-[a-z]+)*|outline(?:-color)?|fill|stroke|caret-color|accent-color|text-decoration(?:-color)?|box-shadow|text-shadow|column-rule(?:-color)?|--[\w-]+)$/

/** Chave de estilo (JS) que carrega cor — verificada dentro de style={…}. */
const STYLE_COLOR_KEY =
  /^(?:color|background(?:Color|Image)?|border(?:Top|Right|Bottom|Left|Block|Inline)?(?:Start|End)?(?:Color)?|outline(?:Color)?|fill|stroke|caretColor|accentColor|textDecoration(?:Color)?|boxShadow|textShadow|columnRule(?:Color)?|stopColor|floodColor|lightingColor|--[\w-]+)$/
/** Chave que só existe em CSS (…Color) ou custom property: verificada em qualquer objeto do arquivo. */
const CSS_ONLY_COLOR_KEY =
  /^(?:background|border(?:Top|Right|Bottom|Left|Block|Inline)?(?:Start|End)?|outline|caret|accent|textDecoration|columnRule|stop|flood|lighting)Color$|^--[\w-]+$/
/** `chave:` de objeto — identificador solto ou custom property entre aspas ('--normal-bg'). */
const OBJECT_KEY = /(?:(['"])(--[\w-]+)\1|(?<![\w$.'"`-])([A-Za-z]+))\s*:(?!:)/g
/** Atributos JSX de cor SVG/QR. */
const COLOR_ATTRIBUTE = /\b(fill|stroke|stopColor|floodColor|lightingColor|bgColor|fgColor)=\{?\s*(['"`])([^'"`]*)\2/g

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
  }
  return out
}

function loadTokens() {
  const css = readFileSync(GLOBALS, 'utf8')
  const tokens = new Set()
  for (const m of css.matchAll(/--color-([a-z0-9-]+)\s*:/g)) tokens.add(m[1])
  return tokens
}

function rel(file) {
  return path.relative(SRC, file).split(path.sep).join('/')
}

/** Prefixo de variante da classe que começa em `index` ('' = estado base; 'hover:', 'md:hover:'…; `!` ignorado). */
function variantOf(line, index) {
  let start = index
  while (start > 0 && !CLASS_SEP.test(line[start - 1])) start--
  return line.slice(start, index).replace(/!/g, '')
}

/** Estados (variantes) em que a linha tem preenchimento sólido escuro: '' = base. */
function darkFillStates(line) {
  const states = new Set()
  for (const m of line.matchAll(SOLID_FILL)) {
    const variant = variantOf(line, m.index)
    if (variant === '' || variant.endsWith(':')) states.add(variant)
  }
  return states
}

/**
 * Cor literal num valor CSS/Tailwind: devolve o trecho culpado ou null. `var(--…)` sem fallback e
 * interpolações `${…}` são removidas antes; nome de cor só conta como palavra solta.
 */
function literalColor(value, checkNames) {
  const v = value
    .replace(/var\(\s*--[\w-]+\s*\)/g, ' ')
    .replace(/\$\{[^}]*\}/g, ' ')
    .replace(/_/g, ' ') // espaço do Tailwind em valor arbitrário (shadow-[0_0_8px_rgba(…)])
  const fn = v.match(COLOR_FUNCTION)
  if (fn) return `${fn[0]}…)`
  if (checkNames) {
    for (const word of v.toLowerCase().split(/[\s,()/_]+/)) {
      if (CSS_NAMED_COLORS.has(word)) return word
    }
  }
  return null
}

/** Índice do fim da string que abre em `i` (aspas simples, duplas ou crase). */
function skipString(text, i) {
  const quote = text[i]
  for (let j = i + 1; j < text.length; j++) {
    if (text[j] === '\\') {
      j++
      continue
    }
    if (text[j] === quote) return j
  }
  return text.length
}

/** Índice do `}` que fecha a chave aberta em `open`, pulando strings. */
function matchBrace(text, open) {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipString(text, i)
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return text.length
}

/** Valor de uma propriedade de objeto a partir de `start`: até a vírgula ou o fechamento no nível 0. */
function readValue(text, start, end) {
  let depth = 0
  for (let i = start; i < end; i++) {
    const ch = text[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipString(text, i)
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) return text.slice(start, i)
      depth--
    } else if (ch === ',' && depth === 0) return text.slice(start, i)
  }
  return text.slice(start, end)
}

/** Strings literais ('…', "…", `…`) dentro de uma expressão. */
function stringLiterals(expr) {
  const out = []
  for (const m of expr.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g)) out.push(m[2])
  return out
}

function scanFile(file, tokens) {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch (err) {
    // Arquivo removido/renomeado entre a listagem e a leitura (editor salvando): não derruba a varredura.
    if (err.code !== 'ENOENT') throw err
    const warning = { file: rel(file), line: 0, text: 'arquivo sumiu durante a varredura — rode de novo' }
    return { findings: [], warnings: [warning] }
  }
  const lines = text.split(/\r?\n/)
  const relPath = rel(file)
  const findings = []
  const warnings = []
  const seen = new Set()

  const lineStarts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1)
  const lineAt = (index) => {
    let lo = 0
    let hi = lineStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (lineStarts[mid] <= index) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }

  const push = (lineNo, token, kind) => {
    const key = `${relPath}:${lineNo}`
    if (ALLOW_LINES.has(key) || ALLOW_TOKENS.has(token)) return
    const dedupe = `${lineNo}|${token}`
    if (seen.has(dedupe)) return
    seen.add(dedupe)
    findings.push({ file: relPath, line: lineNo, token, kind })
  }

  // Regras de linha (1–5 e 7)
  lines.forEach((line, idx) => {
    const lineNo = idx + 1

    for (const m of line.matchAll(TAILWIND_PALETTE)) push(lineNo, m[0], 'paleta Tailwind')

    for (const m of line.matchAll(WHITE_BLACK)) {
      const token = m[0]
      if (token === 'text-white') {
        const variant = variantOf(line, m.index)
        const fills = darkFillStates(line)
        if (fills.has('') || (variant !== '' && fills.has(variant))) continue
        if (fills.size > 0) {
          push(lineNo, token, `branco/preto: o preenchimento escuro da linha só existe em ${[...fills].join(' ')}`)
          continue
        }
      }
      if (
        token === 'bg-white' &&
        lines.slice(idx, idx + QR_WINDOW + 1).some((l) => l.includes('<QRCodeSVG'))
      ) {
        continue
      }
      push(lineNo, token, 'branco/preto')
    }

    for (const m of line.matchAll(HEX)) push(lineNo, m[0], 'hex inline')

    for (const m of line.matchAll(TOKEN_CLASS)) {
      if (!tokens.has(m[2])) push(lineNo, m[0], `token inexistente (--color-${m[2]})`)
    }

    for (const m of line.matchAll(ARBITRARY_VALUE)) {
      const [token, utility, value] = m
      if (/^color:/i.test(value)) {
        push(lineNo, token, 'cor arbitrária (dica color:) — use a classe do token')
        continue
      }
      const culprit = literalColor(value, COLOR_UTILITY.test(utility))
      if (culprit) push(lineNo, token, `cor arbitrária (${culprit})`)
    }

    for (const m of line.matchAll(ARBITRARY_PROPERTY)) {
      const [token, property, value] = m
      const culprit = literalColor(value, COLOR_CSS_PROPERTY.test(property))
      if (culprit) push(lineNo, token, `propriedade arbitrária com cor (${culprit})`)
    }

    for (const m of line.matchAll(COLOR_ATTRIBUTE)) {
      const culprit = literalColor(m[3], true)
      if (culprit) push(lineNo, `${m[1]}="${m[3]}"`, `atributo de cor com literal (${culprit})`)
    }

    if (SOFT_WARNINGS.test(line)) {
      warnings.push({ file: relPath, line: lineNo, text: line.trim().slice(0, 90) })
    }
  })

  // Regra 6: estilo inline. Regiões style={…} (todas as chaves de cor) + o arquivo inteiro (só as chaves …Color e '--x').
  const checkObjectKeys = (from, to, keyFilter) => {
    const region = text.slice(from, to)
    for (const m of region.matchAll(OBJECT_KEY)) {
      const key = m[2] ?? m[3]
      if (!keyFilter.test(key)) continue
      const valueStart = from + m.index + m[0].length
      const value = readValue(text, valueStart, to)
      for (const literal of stringLiterals(value)) {
        const culprit = literalColor(literal, true)
        if (culprit) {
          push(lineAt(valueStart), `${key}: '${literal.trim().slice(0, 40)}'`, `estilo inline com cor literal (${culprit}) — use var(--color-…)`)
        }
      }
    }
  }

  for (const m of text.matchAll(/\bstyle=\{/g)) {
    const open = m.index + m[0].length - 1
    checkObjectKeys(open + 1, matchBrace(text, open), STYLE_COLOR_KEY)
  }
  checkObjectKeys(0, text.length, CSS_ONLY_COLOR_KEY)

  findings.sort((a, b) => a.line - b.line)
  return { findings, warnings }
}

const args = process.argv.slice(2)
const files = args.length ? args.map((a) => path.resolve(a)) : walk(SRC)
const tokens = loadTokens()

const findings = []
const warnings = []
for (const file of files) {
  const result = scanFile(file, tokens)
  findings.push(...result.findings)
  warnings.push(...result.warnings)
}

if (warnings.length > 0) {
  console.log(`Avisos (não falham) — rgba()/hsl()/textShadow, que o tema claro não usa:`)
  for (const w of warnings) console.log(`  src/${w.file}:${w.line}  ${w.text}`)
  console.log('')
}

if (findings.length === 0) {
  console.log(`OK: nenhuma cor crua fora dos tokens (${files.length} arquivo(s) verificado(s)).`)
  process.exit(0)
}

const byFile = new Map()
for (const f of findings) byFile.set(f.file, (byFile.get(f.file) ?? 0) + 1)

console.log('Cor crua fora dos tokens de src/styles/globals.css:')
for (const f of findings) {
  console.log(`  src/${f.file}:${f.line}  ${f.token}  [${f.kind}]`)
}
console.log('')
console.log('Por arquivo:')
for (const [file, count] of [...byFile.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(4)}  src/${file}`)
}
console.log('')
console.log(
  `${findings.length} ocorrência(s) em ${byFile.size} arquivo(s). ` +
    'Troque por tokens (bg-bg-*, text-text-*, border-border-*, bg/text-accent-*-{soft,deep,hover}), ' +
    'Badge color="…" ou Button variant="…"; em estilo inline, var(--color-…). text-white só com um ' +
    'preenchimento sólido escuro na mesma linha e no mesmo estado (sem variante, ou a mesma variante ' +
    'do text-white); bg-white só atrás de <QRCodeSVG.',
)
process.exit(1)

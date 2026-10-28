import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { createReadStream, readFileSync } from 'node:fs'

const fromRoot = (file: string) => fileURLToPath(new URL(file, import.meta.url))

/**
 * SPEC-20261027-1312 — "Tirar o fundo" da foto roda no aparelho com o MediaPipe (@mediapipe/tasks-vision). Os arquivos
 * WASM do pacote (≈ 13 MB cada variante) são servidos pelo próprio site em `/mediapipe/wasm/` — sem CDN de terceiros e
 * sem versionar binário grande: no `vite build` eles são copiados de node_modules para `dist/mediapipe/wasm/`; no
 * servidor de desenvolvimento, servidos direto de node_modules. Só a variante com e sem SIMD do modo clássico (a que o
 * FilesetResolver.forVisionTasks escolhe). O modelo (.tflite, 244 KB) fica em `public/mediapipe/`. Nada disso entra no
 * bundle: o app só baixa quando a pessoa marca "Tirar o fundo".
 */
const MEDIAPIPE_WASM_FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]

function mediapipeWasm(): Plugin {
  const dir = fromRoot('./node_modules/@mediapipe/tasks-vision/wasm/')
  return {
    name: 'poker-da-galera:mediapipe-wasm',
    configureServer(server) {
      server.middlewares.use('/mediapipe/wasm', (req, res, next) => {
        const name = (req.url ?? '').split('?')[0].replace(/^\/+/, '')
        if (!MEDIAPIPE_WASM_FILES.includes(name)) return next()
        res.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript; charset=utf-8')
        createReadStream(dir + name).pipe(res)
      })
    },
    generateBundle() {
      for (const name of MEDIAPIPE_WASM_FILES) {
        this.emitFile({ type: 'asset', fileName: `mediapipe/wasm/${name}`, source: readFileSync(dir + name) })
      }
    },
  }
}

/**
 * SPEC-20261023-1207 — a landing em `/` chega mais rápido no celular: no index.html do build entra um script inline
 * que, SÓ no caminho `/`, já pede (modulepreload) os pedaços da landing sozinha (`src/pages/landing/standalone.tsx`
 * e o que ele importa), em paralelo com a entrada (`boot.tsx`), em vez de esperar a entrada rodar para descobrir
 * que precisa deles. Quem já tem sessão e abre `/` baixa à toa só os pedaços próprios da landing (os do React, do
 * roteador e do cliente HTTP são os mesmos do app). As outras rotas não mudam.
 */
function landingModulePreload(): Plugin {
  const STANDALONE = '/src/pages/landing/standalone.tsx'
  return {
    name: 'poker-da-galera:landing-modulepreload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle
        if (!bundle || !ctx.filename.replace(/\\/g, '/').endsWith('/index.html')) return html
        const chunks = Object.values(bundle).flatMap((c) => (c.type === 'chunk' ? [c] : []))
        const standalone = chunks.find((c) => c.facadeModuleId?.replace(/\\/g, '/').endsWith(STANDALONE))
        if (!standalone) return html
        const files = new Set<string>()
        const visit = (fileName: string) => {
          if (files.has(fileName)) return
          files.add(fileName)
          const chunk = bundle[fileName]
          if (chunk?.type === 'chunk') chunk.imports.forEach(visit)
        }
        visit(standalone.fileName)
        const urls = [...files].map((f) => `/${f}`).filter((url) => !html.includes(`"${url}"`))
        if (!urls.length) return html
        const script =
          `<script>if(location.pathname==='/'){for(const u of ${JSON.stringify(urls)}){` +
          `const l=document.createElement('link');l.rel='modulepreload';l.crossOrigin='';l.href=u;document.head.appendChild(l)}}</script>`
        return html.replace('</head>', `    ${script}\n  </head>`)
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), landingModulePreload(), mediapipeWasm()],
  build: {
    rolldownOptions: {
      // SPEC-20261023-1207: tv.html é o mesmo app com o cartão OG do telão (o nginx o serve em `location = /tv`).
      input: {
        index: fromRoot('./index.html'),
        tv: fromRoot('./tv.html'),
      },
      output: {
        // O CSS do tema é um só e é carregado pelos dois HTML: mantém o nome de sempre (assets/index-<hash>.css),
        // em vez do nome do pedaço de JS a que o empacotador o prende.
        assetFileNames: (asset) =>
          asset.names.some((name) => name.endsWith('.css'))
            ? 'assets/index-[hash][extname]'
            : 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    // Login com Google em http://localhost (SPEC-20261023-1210): o Google Identity Services pede este
    // Referrer-Policy fora de https. Só no servidor de desenvolvimento.
    headers: {
      'Referrer-Policy': 'no-referrer-when-downgrade',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5172',
        changeOrigin: true,
      },
      '/hubs': {
        target: 'http://localhost:5172',
        changeOrigin: true,
        ws: true,
      },
      '/uploads': {
        target: 'http://localhost:5172',
        changeOrigin: true,
      },
    },
  },
})

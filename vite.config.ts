import { cpSync, createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const PDFJS_DIR = resolve(__dirname, 'node_modules/pdfjs-dist')
const PDFJS_ASSET_DIRS = ['cmaps', 'standard_fonts', 'wasm', 'iccs']
const MIME: Record<string, string> = {
  '.bcmap': 'application/octet-stream',
  '.pfb': 'application/octet-stream',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.icc': 'application/vnd.iccprofile',
  '.js': 'text/javascript'
}

/** Serves pdf.js's runtime data at <base>pdfjs/ in dev and copies it into
 *  dist/pdfjs/ on build — same origin, so it works offline and needs no CDN. */
function pdfjsAssets(): Plugin {
  let outDir = ''
  return {
    name: 'inkline-pdfjs-assets',
    configResolved(config) {
      outDir = config.build.outDir
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        const marker = '/pdfjs/'
        const at = url.indexOf(marker)
        if (at === -1) return next()
        const rel = normalize(decodeURIComponent(url.slice(at + marker.length)))
        const [dir] = rel.split(/[\\/]/)
        const file = join(PDFJS_DIR, rel)
        if (!PDFJS_ASSET_DIRS.includes(dir) || !file.startsWith(PDFJS_DIR) || !existsSync(file) || !statSync(file).isFile()) {
          return next()
        }
        res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream')
        createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      for (const dir of PDFJS_ASSET_DIRS) {
        cpSync(join(PDFJS_DIR, dir), join(outDir, 'pdfjs', dir), { recursive: true })
      }
    }
  }
}

/** The production CSP forbids inline scripts, but the dev server's React
 *  Fast Refresh preamble is one — drop the meta tag while serving only. */
function relaxCspInDev(): Plugin {
  return {
    name: 'inkline-relax-csp-in-dev',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace(/<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/, '')
    }
  }
}

/**
 * Standalone browser build — `npm run dev` / `npm run build` output a static
 * site in dist/ that any static host can serve. Set VITE_BASE when serving
 * from a sub-path (e.g. GitHub Pages: VITE_BASE=/inkline/).
 */
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base,
  publicDir: resolve(__dirname, 'public'),
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer')
    }
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: {
          pdfjs: ['pdfjs-dist'],
          pdflib: ['pdf-lib', '@pdf-lib/fontkit'],
          konva: ['konva', 'react-konva'],
          react: ['react', 'react-dom']
        }
      }
    }
  },
  worker: { format: 'es' },
  plugins: [
    react(),
    tailwindcss(),
    pdfjsAssets(),
    relaxCspInDev(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Inkline — PDF Editor',
        short_name: 'Inkline',
        description: 'A genuinely free PDF editor — edit, sign, fill and rearrange PDFs in your browser. No sign-up, no watermark, no export paywall. Files never leave your device.',
        theme_color: '#0b0b1a',
        background_color: '#0b0b1a',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        file_handlers: [{ action: base, accept: { 'application/pdf': ['.pdf'] } }]
      },
      workbox: {
        // App shell + the pdf.js worker; fonts are cached on first use (and
        // prefetched in the background) instead of bloating the install.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/pdfjs/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'inkline-pdfjs-data',
              expiration: { maxEntries: 300 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/fonts/') && url.pathname.endsWith('.ttf'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'inkline-fonts',
              expiration: { maxEntries: 40 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ]
})

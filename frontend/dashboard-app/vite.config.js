import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

const FRONTEND_ROOT = path.resolve(__dirname, '..')
const LEGACY_DASHBOARD_ROOT = path.resolve(FRONTEND_ROOT, 'ui_kits', 'dashboard')
const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
}

function sendFile(req, res, file) {
  res.statusCode = 200
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream')
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  fs.createReadStream(file).pipe(res)
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/app/dist/' : '/',
  plugins: [
    {
      name: 'mytanah-local-landing',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const pathOnly = (req.url || '').split('?')[0]
          const isRead = req.method === 'GET' || req.method === 'HEAD'
          if (isRead && pathOnly.startsWith('/app/')) {
            const rel = decodeURIComponent(pathOnly.replace(/^\/app\/?/, ''))
            const file = path.resolve(FRONTEND_ROOT, rel)
            if (!file.startsWith(FRONTEND_ROOT + path.sep)) {
              res.statusCode = 403
              res.end('Forbidden')
              return
            }
            if (fs.existsSync(file) && fs.statSync(file).isFile()) {
              sendFile(req, res, file)
              return
            }
          }
          if (isRead && (pathOnly === '/' || pathOnly === '/index.html')) {
            sendFile(req, res, path.resolve(LEGACY_DASHBOARD_ROOT, 'index.html'))
            return
          }
          if (
            isRead &&
            /^\/[^/]+$/.test(pathOnly) &&
            /\.(jsx|js|css|geojson|png|jpg|jpeg|svg|mp4)$/.test(pathOnly)
          ) {
            const legacyFile = path.resolve(LEGACY_DASHBOARD_ROOT, decodeURIComponent(pathOnly.slice(1)))
            if (legacyFile.startsWith(LEGACY_DASHBOARD_ROOT + path.sep) && fs.existsSync(legacyFile) && fs.statSync(legacyFile).isFile()) {
              sendFile(req, res, legacyFile)
              return
            }
          }
          next()
        })
      },
    },
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/valuation': 'http://localhost:8000',
      '/hcr': 'http://localhost:8000',
      '/data': 'http://localhost:8000',
      '/rent-comps': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
}))

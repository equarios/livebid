import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import type { Server as HttpServer } from 'node:http'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes } from './routes/auth'
import { accountOnboardingRoutes } from './routes/accountOnboarding'
import { catalogRoutes } from './routes/catalog'
import { commerceRoutes } from './routes/commerce'
import { communityRoutes } from './routes/community'
import { imeiRoutes } from './routes/imei'
import { noticeRoutes } from './routes/notices'
import { settingsRoutes } from './routes/settings'
import { storeRoutes } from './routes/store'
import { marketingHookRoutes, marketingRoutes } from './routes/marketing'
import { startCareLoop } from './careLoop'
import { cacheBackend, initCache } from './cache'
import { prisma } from './db'
import { metricsPrometheus, metricsSnapshot, trackRequest } from './metrics'
import { storageBackend } from './objectStorage'
import { attachRealtime, realtimeClientCount } from './realtime'

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'],
    credentials: true,
  }),
)

app.use('*', async (c, next) => {
  const t0 = Date.now()
  await next()
  trackRequest(c.res.status, Date.now() - t0)
})

app.get('/api/health', async (c) => {
  const started = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return c.json({
      ok: true,
      service: 'livebid-server',
      db: 'up',
      cache: cacheBackend(),
      storage: storageBackend(),
      wsClients: realtimeClientCount(),
      careInline: process.env.CARE_INLINE !== '0',
      latencyMs: Date.now() - started,
    })
  } catch {
    return c.json(
      {
        ok: false,
        service: 'livebid-server',
        db: 'down',
        cache: cacheBackend(),
        storage: storageBackend(),
        wsClients: realtimeClientCount(),
        careInline: process.env.CARE_INLINE !== '0',
        latencyMs: Date.now() - started,
      },
      503,
    )
  }
})

app.get('/api/metrics', (c) => {
  const accept = c.req.header('accept') || ''
  if (accept.includes('text/plain') || c.req.query('format') === 'prom') {
    return c.text(metricsPrometheus(), 200, {
      'content-type': 'text/plain; version=0.0.4; charset=utf-8',
    })
  }
  return c.json({ ok: true, ...metricsSnapshot() })
})

app.use(
  '/uploads/*',
  serveStatic({
    root: './',
  }),
)

app.route('/api/auth', authRoutes)
app.route('/api/account', accountOnboardingRoutes)
app.route('/api/catalog', catalogRoutes)
app.route('/api/commerce', commerceRoutes)
app.route('/api/imei', imeiRoutes)
app.route('/api/store', storeRoutes)
app.route('/api/community', communityRoutes)
app.route('/api/marketing', marketingRoutes)
app.route('/api/marketing/hooks', marketingHookRoutes)
app.route('/api/notices', noticeRoutes)
app.route('/api/settings', settingsRoutes)

const port = Number(process.env.PORT || 8787)

void initCache().then((backend) => {
  console.log(`[cache] backend=${backend}`)
  console.log(`[storage] backend=${storageBackend()}`)
})

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Equarios API listening on http://localhost:${info.port}`)
}) as unknown as HttpServer

attachRealtime(server)

// Settlement + closing-soon: inline by default. Set CARE_INLINE=0 and run `npm run worker`.
if (process.env.CARE_INLINE !== '0') {
  void startCareLoop({ label: 'api-care' })
} else {
  console.log('[care] inline disabled — start the worker: npm run worker')
}

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes } from './routes/auth'
import { catalogRoutes } from './routes/catalog'
import { commerceRoutes } from './routes/commerce'
import { noticeRoutes } from './routes/notices'
import { settingsRoutes } from './routes/settings'
import { runCareJobs } from './settle'

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'],
    credentials: true,
  }),
)

app.get('/api/health', (c) => c.json({ ok: true, service: 'livebid-server' }))

app.route('/api/auth', authRoutes)
app.route('/api/catalog', catalogRoutes)
app.route('/api/commerce', commerceRoutes)
app.route('/api/notices', noticeRoutes)
app.route('/api/settings', settingsRoutes)

const port = Number(process.env.PORT || 8787)
console.log(`Equarios API listening on http://localhost:${port}`)
serve({ fetch: app.fetch, port })

// Win settlement + closing-soon digests (in-app; email per prefs)
void runCareJobs()
setInterval(() => void runCareJobs(), 30_000)

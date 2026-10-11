import type { Server as HttpServer } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { trackWsBroadcast } from './metrics'

export type LotTick = {
  type: 'lot.tick'
  lotId: string
  currentPrice: number
  bidCount: number
  bid?: {
    id?: string
    lotId: string
    accountId: string
    amount: number
    qty: number
    at: number
  }
}

type Client = { ws: WebSocket; channels: Set<string> }

const clients = new Set<Client>()

export function attachRealtime(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws) => {
    const client: Client = { ws, channels: new Set(['auctions']) }
    clients.add(client)

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as { type?: string; channels?: string[] }
        if (msg.type === 'subscribe' && Array.isArray(msg.channels)) {
          client.channels = new Set(msg.channels.filter((c) => typeof c === 'string'))
          if (!client.channels.size) client.channels.add('auctions')
        }
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', t: Date.now() }))
        }
      } catch {
        /* ignore bad frames */
      }
    })

    ws.on('close', () => clients.delete(client))
    ws.on('error', () => clients.delete(client))

    ws.send(JSON.stringify({ type: 'ready', channels: [...client.channels] }))
  })

  console.log('[realtime] WebSocket on /ws')
  return wss
}

export function broadcastLotTick(tick: LotTick) {
  const payload = JSON.stringify(tick)
  let sent = 0
  for (const client of clients) {
    if (!client.channels.has('auctions')) continue
    if (client.ws.readyState !== WebSocket.OPEN) continue
    try {
      client.ws.send(payload)
      sent += 1
    } catch {
      clients.delete(client)
    }
  }
  if (sent) trackWsBroadcast()
}

export function realtimeClientCount() {
  return clients.size
}

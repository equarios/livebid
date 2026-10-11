type LotTickHandler = (tick: {
  lotId: string
  currentPrice: number
  bidCount: number
  bid?: {
    lotId: string
    accountId: string
    amount: number
    qty: number
    at: number
  }
}) => void

let socket: WebSocket | null = null
let wanted = false
let retryMs = 1000
const tickHandlers = new Set<LotTickHandler>()

function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws`
}

function connect() {
  if (!wanted || socket) return
  try {
    const ws = new WebSocket(wsUrl())
    socket = ws
    ws.onopen = () => {
      retryMs = 1000
      ws.send(JSON.stringify({ type: 'subscribe', channels: ['auctions'] }))
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as {
          type?: string
          lotId?: string
          currentPrice?: number
          bidCount?: number
          bid?: {
            lotId: string
            accountId: string
            amount: number
            qty: number
            at: number
          }
        }
        if (msg.type !== 'lot.tick' || !msg.lotId) return
        const tick = {
          lotId: msg.lotId,
          currentPrice: Number(msg.currentPrice) || 0,
          bidCount: Number(msg.bidCount) || 0,
          bid: msg.bid,
        }
        for (const h of tickHandlers) h(tick)
      } catch {
        /* ignore */
      }
    }
    ws.onclose = () => {
      socket = null
      if (!wanted) return
      window.setTimeout(connect, retryMs)
      retryMs = Math.min(15_000, retryMs * 1.5)
    }
    ws.onerror = () => {
      try {
        ws.close()
      } catch {
        /* ignore */
      }
    }
  } catch {
    socket = null
    if (wanted) window.setTimeout(connect, retryMs)
  }
}

export function startRealtime() {
  wanted = true
  connect()
}

export function stopRealtime() {
  wanted = false
  if (socket) {
    try {
      socket.close()
    } catch {
      /* ignore */
    }
  }
  socket = null
}

export function onLotTick(handler: LotTickHandler) {
  tickHandlers.add(handler)
  return () => {
    tickHandlers.delete(handler)
  }
}

export function realtimeConnected() {
  return !!socket && socket.readyState === WebSocket.OPEN
}

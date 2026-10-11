type Counters = {
  httpRequests: number
  httpErrors: number
  bidsOk: number
  bidsRejected: number
  careRuns: number
  careErrors: number
  wsBroadcasts: number
}

const startedAt = Date.now()
const counters: Counters = {
  httpRequests: 0,
  httpErrors: 0,
  bidsOk: 0,
  bidsRejected: 0,
  careRuns: 0,
  careErrors: 0,
  wsBroadcasts: 0,
}

const latencies: number[] = []
const LAT_MAX = 500

export function trackRequest(status: number, ms: number) {
  counters.httpRequests += 1
  if (status >= 500) counters.httpErrors += 1
  latencies.push(ms)
  if (latencies.length > LAT_MAX) latencies.shift()
}

export function trackBid(ok: boolean) {
  if (ok) counters.bidsOk += 1
  else counters.bidsRejected += 1
}

export function trackCare(ok: boolean) {
  if (ok) counters.careRuns += 1
  else counters.careErrors += 1
}

export function trackWsBroadcast() {
  counters.wsBroadcasts += 1
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[i] ?? 0
}

export function metricsSnapshot() {
  const sorted = [...latencies].sort((a, b) => a - b)
  return {
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    ...counters,
    latencyMs: {
      samples: sorted.length,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    },
  }
}

/** Prometheus text exposition (subset). */
export function metricsPrometheus() {
  const s = metricsSnapshot()
  const lines = [
    `# HELP equarios_http_requests_total HTTP requests`,
    `# TYPE equarios_http_requests_total counter`,
    `equarios_http_requests_total ${s.httpRequests}`,
    `# HELP equarios_http_errors_total HTTP 5xx responses`,
    `# TYPE equarios_http_errors_total counter`,
    `equarios_http_errors_total ${s.httpErrors}`,
    `# HELP equarios_bids_ok_total Successful bids`,
    `# TYPE equarios_bids_ok_total counter`,
    `equarios_bids_ok_total ${s.bidsOk}`,
    `# HELP equarios_bids_rejected_total Rejected bids`,
    `# TYPE equarios_bids_rejected_total counter`,
    `equarios_bids_rejected_total ${s.bidsRejected}`,
    `# HELP equarios_care_runs_total Care worker runs`,
    `# TYPE equarios_care_runs_total counter`,
    `equarios_care_runs_total ${s.careRuns}`,
    `# HELP equarios_ws_broadcasts_total Lot tick broadcasts`,
    `# TYPE equarios_ws_broadcasts_total counter`,
    `equarios_ws_broadcasts_total ${s.wsBroadcasts}`,
    `# HELP equarios_latency_ms Request latency`,
    `# TYPE equarios_latency_ms summary`,
    `equarios_latency_ms{quantile="0.5"} ${s.latencyMs.p50}`,
    `equarios_latency_ms{quantile="0.95"} ${s.latencyMs.p95}`,
    `equarios_latency_ms{quantile="0.99"} ${s.latencyMs.p99}`,
  ]
  return lines.join('\n') + '\n'
}

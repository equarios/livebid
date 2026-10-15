import { useEffect } from 'react'
import { api } from './api'
import { drainWatchFilterNotices } from './watchFilters'
import { useNow, useStore } from '../store'

/** Sync watch-filter matches → NoticeBell (email batched into daily digest when digest on). */
export function useWatchFilterNotices() {
  const { user, lots, apiMode, appendLocalNotices, refreshNotices } = useStore()
  const now = useNow()

  useEffect(() => {
    if (!user) return
    const rows = drainWatchFilterNotices(user.accountId, lots, now)
    if (!rows.length) return

    if (!apiMode) {
      appendLocalNotices(rows)
      return
    }

    let cancelled = false
    void (async () => {
      for (const n of rows) {
        if (cancelled) return
        try {
          await api.pushNotice({
            accountId: user.accountId,
            kind: 'watch',
            title: n.title,
            body: n.body,
            href: n.href,
            id: n.id,
          })
        } catch {
          /* offline / duplicate */
        }
      }
      if (!cancelled) await refreshNotices().catch(() => undefined)
    })()

    return () => {
      cancelled = true
    }
  }, [user, lots, now, apiMode, appendLocalNotices, refreshNotices])
}

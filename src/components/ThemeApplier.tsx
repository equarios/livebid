import { useEffect } from 'react'
import { useStore } from '../store'

export function ThemeApplier() {
  const { settings } = useStore()
  const t = settings.theme

  useEffect(() => {
    const r = document.documentElement
    r.style.setProperty('--navy', t.navy)
    r.style.setProperty('--navy-2', t.navy2)
    r.style.setProperty('--ink', t.ink)
    r.style.setProperty('--muted', t.muted)
    r.style.setProperty('--line', t.line)
    r.style.setProperty('--bg', t.bg)
    r.style.setProperty('--card', t.card)
    r.style.setProperty('--win', t.win)
    r.style.setProperty('--lose', t.lose)
    r.style.setProperty('--live', t.live)
    r.style.setProperty('--teal', t.live)
    r.style.setProperty('--radius', t.radius)
    r.style.setProperty('--font', t.font)
    r.style.setProperty('--shadow', '0 8px 28px rgba(18, 44, 62, 0.08)')
    r.style.setProperty('--shadow-sm', '0 1px 2px rgba(18, 44, 62, 0.06)')
    r.style.fontFamily = t.font
    r.style.color = t.ink
    r.style.background = t.bg
    document.title = `${settings.brandName} | ${settings.tagline}`
  }, [
    t.navy,
    t.navy2,
    t.ink,
    t.muted,
    t.line,
    t.bg,
    t.card,
    t.win,
    t.lose,
    t.live,
    t.radius,
    t.font,
    settings.brandName,
    settings.tagline,
  ])

  return null
}

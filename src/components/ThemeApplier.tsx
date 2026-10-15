import { useEffect } from 'react'
import { DEFAULT_SETTINGS } from '../data'
import { useStore } from '../store'
import type { ThemeSettings } from '../types'

function px(n: number | undefined, fallback: number) {
  const v = Number(n)
  if (!Number.isFinite(v)) return `${fallback}px`
  return `${Math.min(36, Math.max(10, Math.round(v)))}px`
}

function weight(n: number | undefined, fallback: number) {
  const v = Number(n)
  if (!Number.isFinite(v)) return String(fallback)
  return String(Math.min(900, Math.max(100, Math.round(v))))
}

function unitless(n: number | undefined, fallback: number, min: number, max: number) {
  const v = Number(n)
  if (!Number.isFinite(v)) return String(fallback)
  return String(Math.min(max, Math.max(min, Math.round(v * 100) / 100)))
}

function em(n: number | undefined, fallback: number) {
  const v = Number(n)
  if (!Number.isFinite(v)) return `${fallback}em`
  return `${Math.min(0.2, Math.max(-0.05, Math.round(v * 1000) / 1000))}em`
}

function linkUnderline(mode: ThemeSettings['linkUnderline'] | undefined) {
  if (mode === 'always') return 'underline'
  return 'none'
}

function linkUnderlineHover(mode: ThemeSettings['linkUnderline'] | undefined) {
  if (mode === 'none') return 'none'
  return 'underline'
}

export function ThemeApplier() {
  const { settings } = useStore()
  const t = settings?.theme || DEFAULT_SETTINGS.theme
  const brand = settings?.brandName || DEFAULT_SETTINGS.brandName
  const tagline = settings?.tagline || DEFAULT_SETTINGS.tagline
  const d = DEFAULT_SETTINGS.theme

  useEffect(() => {
    const r = document.documentElement
    const underline = t.linkUnderline || d.linkUnderline
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
    r.style.setProperty('--display', t.displayFont || d.displayFont)
    r.style.setProperty('--font-size', px(t.fontSize, d.fontSize))
    r.style.setProperty('--font-size-tiny', px(t.fontSizeTiny, d.fontSizeTiny))
    r.style.setProperty('--font-size-label', px(t.fontSizeLabel, d.fontSizeLabel))
    r.style.setProperty('--font-size-price', px(t.fontSizePrice, d.fontSizePrice))
    r.style.setProperty('--font-size-h1', px(t.fontSizeH1, d.fontSizeH1))
    r.style.setProperty('--font-size-h2', px(t.fontSizeH2, d.fontSizeH2))
    r.style.setProperty('--font-size-button', px(t.fontSizeButton, d.fontSizeButton))
    r.style.setProperty('--font-weight', weight(t.fontWeightBody, d.fontWeightBody))
    r.style.setProperty('--font-weight-bold', weight(t.fontWeightBold, d.fontWeightBold))
    r.style.setProperty('--font-weight-heading', weight(t.fontWeightHeading, d.fontWeightHeading))
    r.style.setProperty('--font-weight-button', weight(t.fontWeightButton, d.fontWeightButton))
    r.style.setProperty('--font-weight-link', weight(t.fontWeightLink, d.fontWeightLink))
    r.style.setProperty('--line-height', unitless(t.lineHeight, d.lineHeight, 1.1, 2))
    r.style.setProperty('--line-height-tiny', unitless(t.lineHeightTiny, d.lineHeightTiny, 1.1, 2))
    r.style.setProperty(
      '--line-height-heading',
      unitless(t.lineHeightHeading, d.lineHeightHeading, 1, 1.6),
    )
    r.style.setProperty('--letter-spacing', em(t.letterSpacing, d.letterSpacing))
    r.style.setProperty('--letter-spacing-label', em(t.letterSpacingLabel, d.letterSpacingLabel))
    r.style.setProperty('--link-underline', linkUnderline(underline))
    r.style.setProperty('--link-underline-hover', linkUnderlineHover(underline))
    r.style.setProperty('--shadow', '0 8px 28px rgba(18, 44, 62, 0.08)')
    r.style.setProperty('--shadow-sm', '0 1px 2px rgba(18, 44, 62, 0.06)')
    r.style.fontFamily = t.font
    r.style.fontSize = px(t.fontSize, d.fontSize)
    r.style.fontWeight = weight(t.fontWeightBody, d.fontWeightBody)
    r.style.lineHeight = unitless(t.lineHeight, d.lineHeight, 1.1, 2)
    r.style.letterSpacing = em(t.letterSpacing, d.letterSpacing)
    r.style.color = t.ink
    r.style.background = t.bg
    document.title = `${brand} | ${tagline}`
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
    t.displayFont,
    t.fontSize,
    t.fontSizeTiny,
    t.fontSizeLabel,
    t.fontSizePrice,
    t.fontSizeH1,
    t.fontSizeH2,
    t.fontSizeButton,
    t.fontWeightBody,
    t.fontWeightBold,
    t.fontWeightHeading,
    t.fontWeightButton,
    t.fontWeightLink,
    t.lineHeight,
    t.lineHeightTiny,
    t.lineHeightHeading,
    t.letterSpacing,
    t.letterSpacingLabel,
    t.linkUnderline,
    brand,
    tagline,
    d.displayFont,
    d.fontSize,
    d.fontSizeTiny,
    d.fontSizeLabel,
    d.fontSizePrice,
    d.fontSizeH1,
    d.fontSizeH2,
    d.fontSizeButton,
    d.fontWeightBody,
    d.fontWeightBold,
    d.fontWeightHeading,
    d.fontWeightButton,
    d.fontWeightLink,
    d.lineHeight,
    d.lineHeightTiny,
    d.lineHeightHeading,
    d.letterSpacing,
    d.letterSpacingLabel,
    d.linkUnderline,
  ])

  return null
}

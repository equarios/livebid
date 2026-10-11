import { useEffect, useState } from 'react'

export type DeskIntroSlide = {
  title: string
  body: string
  imageUrl: string
}

/** Compact lander slider — brand fixed; photo + copy crossfade. Keeps command bars intact. */
export function DeskIntro({
  brand,
  slides,
  intervalSec = 7,
  veil = 'trade',
  label,
}: {
  brand: string
  slides: DeskIntroSlide[]
  /** Auto-advance seconds (shared with store/wholesale heroes). */
  intervalSec?: number
  /** `trade` = auctions/marketplace tone; `ops` = admin/super veil. */
  veil?: 'trade' | 'ops'
  label?: string
}) {
  const list =
    slides.length > 0
      ? slides
      : [{ title: '', body: '', imageUrl: '' }]
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const active = list[Math.min(index, list.length - 1)]!
  const aria = label || active.title || 'Desk'

  const slideKey = list.map((s) => `${s.title}|${s.imageUrl}`).join('||')

  useEffect(() => {
    setIndex(0)
  }, [slideKey])

  useEffect(() => {
    if (list.length < 2 || paused) return
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const ms = Math.max(4, intervalSec) * 1000
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % list.length)
    }, ms)
    return () => window.clearInterval(id)
  }, [list.length, intervalSec, paused, slideKey])

  return (
    <header
      className="desk-banner land-hero land-hero-slider"
      aria-label={aria}
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="land-hero-media" aria-hidden>
        {list.map((slide, i) => (
          <div
            key={`${slide.imageUrl}-${i}`}
            className={`land-hero-photo${i === index ? ' is-on' : ''}`}
            style={
              slide.imageUrl ? { backgroundImage: `url(${slide.imageUrl})` } : undefined
            }
          />
        ))}
        <div className={`land-hero-veil${veil === 'ops' ? ' is-wholesale' : ''}`} />
        <div className="land-hero-grain" />
      </div>
      <div className="desk-banner-copy">
        <p className="desk-banner-brand">{brand}</p>
        <div key={index} className="desk-banner-text land-hero-slide-copy">
          <h1>{active.title}</h1>
          <p>{active.body}</p>
        </div>
      </div>
      {list.length > 1 ? (
        <div className="land-hero-dots desk-banner-dots" role="tablist" aria-label="Banner slides">
          {list.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}`}
              className={i === index ? 'on' : undefined}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </header>
  )
}

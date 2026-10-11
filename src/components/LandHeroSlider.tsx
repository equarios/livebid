import { useEffect, useState, type ReactNode } from 'react'

export type LandHeroSlide = {
  title: string
  body: string
  cta: string
  imageUrl: string
}

type Props = {
  brand: string
  label: string
  slides: LandHeroSlide[]
  intervalSec?: number
  veilClassName?: string
  primary: (slide: LandHeroSlide, index: number) => ReactNode
  secondary: ReactNode
}

const FALLBACK_PHOTO =
  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=2000&q=72'

/** Full-bleed hero: brand stays fixed; photo + copy crossfade. */
export function LandHeroSlider({
  brand,
  label,
  slides,
  intervalSec = 7,
  veilClassName,
  primary,
  secondary,
}: Props) {
  const list =
    slides.length > 0
      ? slides.map((s) => ({
          ...s,
          imageUrl: s.imageUrl?.trim() || FALLBACK_PHOTO,
        }))
      : [
          {
            title: '',
            body: '',
            cta: '',
            imageUrl: FALLBACK_PHOTO,
          },
        ]
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const active = list[Math.min(index, list.length - 1)]!

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
  }, [list.length, intervalSec, paused])

  return (
    <section
      className="land-hero land-hero-slider"
      aria-label={label}
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="land-hero-media" aria-hidden>
        {list.map((slide, i) => (
          <div
            key={`${slide.imageUrl}-${i}`}
            className={`land-hero-photo${i === index ? ' is-on' : ''}`}
            style={{ backgroundImage: `url(${slide.imageUrl})` }}
          />
        ))}
        <div className={`land-hero-veil${veilClassName ? ` ${veilClassName}` : ''}`} />
        <div className="land-hero-grain" />
      </div>

      <div className="land-hero-copy">
        <p className="land-hero-brand">{brand}</p>
        <div key={index} className="land-hero-slide-copy">
          <h1>{active.title}</h1>
          <p className="land-hero-lead">{active.body}</p>
          <div className="land-hero-cta">
            {primary(active, index)}
            {secondary}
          </div>
        </div>
      </div>

      {list.length > 1 ? (
        <div className="land-hero-dots" role="tablist" aria-label="Hero slides">
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
    </section>
  )
}

import type { ReactNode } from 'react'

/** Render Super-editable marketing body (steps, bullets, or paragraphs). */
export function renderPageBody(body: string): ReactNode {
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return null

  const stepLines = lines.filter((l) => l.includes('|'))
  if (stepLines.length === lines.length) {
    return (
      <ol className="pub-steps">
        {stepLines.map((line, i) => {
          const [title, ...rest] = line.split('|')
          const detail = rest.join('|').trim()
          return (
            <li key={i}>
              <span className="how-step-n" aria-hidden>
                {String(i + 1).padStart(2, '0')}
              </span>
              <strong>{title.trim()}</strong>
              {detail ? <span>{detail}</span> : null}
            </li>
          )
        })}
      </ol>
    )
  }

  const bulletLines = lines.filter((l) => l.startsWith('- ') || l.startsWith('• '))
  if (bulletLines.length === lines.length) {
    return (
      <ul className="pub-help-list">
        {bulletLines.map((line, i) => (
          <li key={i}>{line.replace(/^[-•]\s*/, '')}</li>
        ))}
      </ul>
    )
  }

  return lines.map((line, i) => (
    <p key={i} className="muted">
      {line.replace(/^[-•]\s*/, '')}
    </p>
  ))
}

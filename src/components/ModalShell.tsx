import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  onClose: () => void
  children: ReactNode
  className?: string
}

export function ModalShell({ onClose, children, className }: Props) {
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    const prevPad = body.style.paddingRight
    const gap = window.innerWidth - html.clientWidth
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    if (gap > 0) body.style.paddingRight = `${gap}px`
    return () => {
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
      body.style.paddingRight = prevPad
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className={`modal-backdrop${className ? ` ${className}` : ''}`}
      role="presentation"
      onClick={onClose}
    >
      {children}
    </div>,
    document.body,
  )
}

import type { ReactNode } from 'react'
import { ModalShell } from './ModalShell'
import { useStore } from '../store'

type Props = {
  title: string
  body: string
  onCancel: () => void
  onConfirm: () => void
  children?: ReactNode
}

export function ConfirmDialog({ title, body, onCancel, onConfirm, children }: Props) {
  const { settings } = useStore()
  const copy = settings.copy

  return (
    <ModalShell onClose={onCancel}>
      <div
        className="modal card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-action-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-action-title">{title}</h2>
        <p className="muted">{body}</p>
        {children}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            {copy.btnCancel}
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            {copy.btnConfirm}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

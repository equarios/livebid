import type { ReactNode } from 'react'
import { ModalShell } from './ModalShell'
import { useStore } from '../store'

type Props = {
  title: string
  body: string
  onCancel: () => void
  onConfirm: () => void
  children?: ReactNode
  className?: string
  confirmDisabled?: boolean
}

export function ConfirmDialog({
  title,
  body,
  onCancel,
  onConfirm,
  children,
  className,
  confirmDisabled,
}: Props) {
  const { settings } = useStore()
  const copy = settings.copy

  return (
    <ModalShell onClose={onCancel}>
      <div
        className={`modal card${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-action-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-action-title">{title}</h2>
        <p className="muted">{body}</p>
        {children}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            {copy.btnCancel}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {copy.btnConfirm}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

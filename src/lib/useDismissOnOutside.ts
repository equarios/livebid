import { useEffect, type RefObject } from 'react'

/**
 * Dismiss an open popover/menu when the user clicks outside it or presses Escape.
 * Use for header toggles that would otherwise stay “stuck” until clicked again.
 */
export function useDismissOnOutside(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!open) return
    function onPointer(e: PointerEvent) {
      const el = rootRef.current
      if (!el) return
      if (e.target instanceof Node && el.contains(e.target)) return
      onDismiss()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, rootRef, onDismiss])
}

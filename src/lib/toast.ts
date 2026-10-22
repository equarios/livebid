export type ToastTone = 'ok' | 'err' | 'warn'

export type ToastAction = { href: string; label: string }

export type AppToast = {
  id: number
  text: string
  tone: ToastTone
  action?: ToastAction
}

type Listener = (toast: AppToast | null) => void

const listeners = new Set<Listener>()

export const TOAST_MS = 6500

export function pushToast(text: string, tone: ToastTone = 'ok', action?: ToastAction) {
  const toast: AppToast = { id: Date.now(), text, tone, action }
  listeners.forEach((fn) => fn(toast))
}

export function toastMsg(text: string | null | undefined) {
  if (!text) return
  const bad =
    /fail|could not|error|invalid|not found|cannot|only staff|declined nothing|must be valid|no warehouse|exceeds|at least 1|at least one|required|picker first|fill list/i.test(
      text,
    )
  pushToast(text, bad ? 'err' : 'ok')
}

export function dismissToast() {
  listeners.forEach((fn) => fn(null))
}

export function subscribeToast(fn: Listener) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

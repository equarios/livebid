import { pushToast } from './toast'
import { storeCartCount } from './storeCart'

/** Retail store feedback — same toast + CTA pattern as auctions/marketplace. */
export function storeAddedToCart(title: string, qty = 1) {
  const n = storeCartCount()
  const label = qty > 1 ? `Added ${qty} × ${title}` : `Added ${title}`
  pushToast(`${label} · ${n} in cart`, 'ok', {
    href: '/store/cart',
    label: 'View cart',
  })
  pulseStoreCartBadge()
}

export function storeRemovedFromCart(title?: string) {
  pushToast(title ? `Removed ${title}` : 'Removed from cart', 'ok', {
    href: '/store',
    label: 'Continue shopping',
  })
  pulseStoreCartBadge()
}

export function storeCartUpdated() {
  pulseStoreCartBadge()
}

export function storeNeedsAckWarn() {
  pushToast('Confirm lock / as-is details before adding.', 'warn')
}

export function storeOrderPlaced(orderId: string, pay?: string | null) {
  const pending =
    pay === 'bank' || pay === 'usdt' || pay === 'cash'
      ? ' · awaiting payment confirmation'
      : ''
  pushToast(`Order ${orderId} placed${pending}`, 'ok', {
    href: `/store/orders?placed=${encodeURIComponent(orderId)}${pay ? `&pay=${pay}` : ''}`,
    label: 'View order',
  })
}

export function storeOrderError(message: string) {
  pushToast(message, 'err')
}

/** Brief pulse on cart count badges (nav + rail). */
export function pulseStoreCartBadge() {
  if (typeof document === 'undefined') return
  window.setTimeout(() => {
    document.querySelectorAll('.gd-count, .store-rail-cart-n').forEach((el) => {
      el.classList.remove('is-pulse')
      void (el as HTMLElement).offsetWidth
      el.classList.add('is-pulse')
    })
  }, 40)
}

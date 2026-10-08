import { useStore } from '../store'

export function BrandLogo({ size = 'header' }: { size?: 'header' | 'auth' | 'footer' }) {
  const { settings } = useStore()
  return (
    <img
      className={`brand-logo brand-logo-${size}`}
      src={settings.brandLogo || '/equarios-logo.png'}
      alt={settings.brandName}
    />
  )
}

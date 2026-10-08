import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'

export function ShopSubnav({ shopLinks = true }: { shopLinks?: boolean }) {
  const { lots, user, settings } = useStore()
  const navigate = useNavigate()
  const makers = [...new Set(lots.map((l) => l.manufacturer))].slice(0, 8)

  function go(path: string) {
    if (user) navigate(path)
    else navigate('/login', { state: { from: path } })
  }

  return (
    <div className="pub-subnav shop-subnav">
      {shopLinks && settings.showAuctions ? (
        <button type="button" onClick={() => go('/auctions')}>
          All Auctions
        </button>
      ) : null}
      <button type="button" onClick={() => go('/auctions')}>
        All Categories
      </button>
      {makers.map((m) => (
        <button key={m} type="button" onClick={() => go(`/auctions?q=${encodeURIComponent(m)}`)}>
          {m}
        </button>
      ))}
      {shopLinks && settings.showMarketplace ? (
        <button type="button" onClick={() => go('/marketplace')}>
          Buy Now
        </button>
      ) : null}
    </div>
  )
}

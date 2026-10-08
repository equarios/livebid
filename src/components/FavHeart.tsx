import { useStore } from '../store'

export function FavHeart({ lotId }: { lotId: string }) {
  const { watchlist, toggleWatch, settings } = useStore()
  const on = watchlist.includes(lotId)
  return (
    <button
      type="button"
      className={`fav-heart ${on ? 'on' : ''}`}
      aria-label={on ? settings.copy.favRemove : settings.copy.favAdd}
      aria-pressed={on}
      title={on ? settings.copy.favRemove : settings.copy.favAdd}
      onClick={() => toggleWatch(lotId)}
    >
      <span aria-hidden="true">{settings.icons.favourite}</span>
    </button>
  )
}

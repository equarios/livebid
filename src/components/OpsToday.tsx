import type { OpsQueueCounts } from '../lib/opsQueues'

type Card = {
  id: string
  section: string
  desk?: string
  title: string
  count: number
  hint: string
  tone?: 'urgent' | 'open' | 'muted'
}

type Props = {
  role: 'admin' | 'super'
  queues: OpsQueueCounts
  liveLots: number
  /** Lots currently in Extra sealed overtime. */
  sealedLots?: number
  inventoryCount: number
  onGo: (section: string, desk?: string) => void
}

export function OpsToday({
  role,
  queues,
  liveLots,
  sealedLots = 0,
  inventoryCount,
  onGo,
}: Props) {
  const sealedCard: Card = {
    id: 'sealed',
    section: 'catalog',
    desk: 'lots',
    title: 'Extra sealed now',
    count: sealedLots,
    hint: sealedLots
      ? 'Lots in overtime — prior bidders only · watch the floor'
      : 'No lots in Extra sealed right now',
    tone: sealedLots ? 'urgent' : 'muted',
  }

  const cards: Card[] =
    role === 'admin'
      ? [
          {
            id: 'carts',
            section: 'commerce',
            desk: 'carts',
            title: 'Carts to review',
            count: queues.pendingCarts,
            hint: 'Accept or decline listed-price checkouts',
            tone: queues.pendingCarts ? 'urgent' : 'muted',
          },
          {
            id: 'offers',
            section: 'commerce',
            desk: 'offers',
            title: 'Offers to review',
            count: queues.pendingOffers,
            hint: 'Buyer price offers waiting on staff',
            tone: queues.pendingOffers ? 'urgent' : 'muted',
          },
          {
            id: 'money',
            section: 'money',
            title: 'Invoices / payments',
            count: queues.money,
            hint: 'Draft issue queue and payment stamps',
            tone: queues.money ? 'open' : 'muted',
          },
          {
            id: 'catalog',
            section: 'catalog',
            desk: 'inventory',
            title: 'Inventory',
            count: inventoryCount,
            hint: queues.catalogWaitItems
              ? `${queues.catalogWaitItems} item(s) waiting on Super`
              : 'Publish lots from SKUs',
            tone: queues.catalogWaitItems ? 'open' : 'muted',
          },
          {
            id: 'lots',
            section: 'catalog',
            desk: 'lots',
            title: 'Live lots',
            count: liveLots,
            hint: 'Edit, reopen, or remove live listings',
            tone: 'muted',
          },
          sealedCard,
          {
            id: 'wholesale',
            section: 'buyers',
            title: 'Wholesale apps',
            count: queues.wholesaleApps,
            hint: queues.wholesaleApps
              ? `${queues.wholesaleSubmitted} in review · ${queues.wholesaleNeedsDocs} needs docs`
              : 'No buyer applications waiting',
            tone: queues.wholesaleApps ? 'urgent' : 'muted',
          },
          {
            id: 'stuck',
            section: 'buyers',
            title: 'Idle approved',
            count: queues.wholesaleStuck,
            hint: queues.wholesaleStuck
              ? 'Approved buyers with no recent bids — nudge from Wholesale desk'
              : 'No idle approved buyers',
            tone: queues.wholesaleStuck ? 'open' : 'muted',
          },
        ]
      : [
          {
            id: 'confirm',
            section: 'catalog',
            title: 'Catalog confirms',
            count: queues.catalogWaitItems,
            hint: 'Approve Admin listing drops before they go live',
            tone: queues.catalogWaitItems ? 'urgent' : 'muted',
          },
          sealedCard,
          {
            id: 'money',
            section: 'money',
            title: 'Invoices / payments',
            count: queues.money,
            hint: 'Issue drafts and final-confirm receipts',
            tone: queues.money ? 'urgent' : 'muted',
          },
          {
            id: 'people',
            section: 'people',
            title: 'Accounts pending',
            count: queues.pendingAccounts,
            hint: 'Approve buyers and manage people',
            tone: queues.pendingAccounts ? 'open' : 'muted',
          },
          {
            id: 'wholesale',
            section: 'people',
            title: 'Wholesale apps',
            count: queues.wholesaleApps,
            hint: queues.wholesaleApps
              ? `${queues.wholesaleSubmitted} in review · ${queues.wholesaleNeedsDocs} needs docs`
              : 'No buyer applications waiting',
            tone: queues.wholesaleApps ? 'urgent' : 'muted',
          },
          {
            id: 'stuck',
            section: 'people',
            title: 'Idle approved',
            count: queues.wholesaleStuck,
            hint: queues.wholesaleStuck
              ? 'Approved buyers with no recent bids — nudge from Wholesale desk'
              : 'No idle approved buyers',
            tone: queues.wholesaleStuck ? 'open' : 'muted',
          },
        ]

  const waiting = cards.filter((c) => c.count > 0)

  return (
    <div className="ops-today">
      <header className="ops-today-head">
        <h2>Today</h2>
        <p className="muted tiny">
          {waiting.length
            ? `${waiting.length} queue${waiting.length === 1 ? '' : 's'} need attention.`
            : role === 'admin'
              ? 'Nothing waiting. Use the nav for IMEI, store, buyers, and tools.'
              : 'Nothing waiting. Use the nav for people, clients, and settings — IMEI is under Admin.'}
        </p>
      </header>
      <div className="ops-today-grid">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={`ops-today-card is-${card.tone || 'muted'}`}
            onClick={() => onGo(card.section, card.desk)}
          >
            <span className="ops-today-count">{card.count}</span>
            <span className="ops-today-title">{card.title}</span>
            <span className="muted tiny">{card.hint}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

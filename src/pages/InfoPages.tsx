import { HelpLayout } from '../components/HelpLayout'

export function DeviceSpec() {
  return (
    <HelpLayout
      page="device-spec"
      title="Device spec"
      lead="Grade, battery, SIM, and activation notes used on lots."
    >
      <section className="help-panel">
        <h2>Grades</h2>
        <dl className="help-grade-list">
          <div>
            <dt>S</dt>
            <dd>Like new / open box</dd>
          </div>
          <div>
            <dt>A</dt>
            <dd>Light cosmetic wear, full function</dd>
          </div>
          <div>
            <dt>B</dt>
            <dd>Visible wear, tested working</dd>
          </div>
          <div>
            <dt>C</dt>
            <dd>Heavy wear or housing damage</dd>
          </div>
        </dl>
      </section>
    </HelpLayout>
  )
}

export function InfoPage() {
  return (
    <HelpLayout
      page="info"
      title="Info"
      lead="How fills, invoices, and dual payment approval work."
    >
      <section className="help-panel">
        <p>
          Bids fill from the last bid per account, highest price first. You only see your own
          allocated pcs.
        </p>
        <p>
          Marketplace checkout creates unpaid invoices. Mark paid and upload a receipt. Admin and
          super admin both accept before it is paid.
        </p>
      </section>
    </HelpLayout>
  )
}

export function Tutorial() {
  return (
    <HelpLayout
      page="tutorial"
      title="How it works"
      lead="Quick path for a wholesale buyer."
    >
      <section className="help-panel">
        <ol className="help-steps">
          <li>Open Auction, set qty and price, confirm bid.</li>
          <li>
            Live Auctions: watch fill and winning in Winning Status. Offline Auctions hide win/lose
            until close.
          </li>
          <li>Buy fixed stock on Marketplace, then Checkout.</li>
          <li>My Page → Invoice: pay and upload receipt.</li>
          <li>Bid History shows Won / Partially Won / Lost after you bid.</li>
        </ol>
      </section>
    </HelpLayout>
  )
}

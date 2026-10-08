export function DeviceSpec() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Device spec</h1>
          <p className="muted">Grade, battery, SIM, and activation notes used on lots.</p>
        </div>
      </div>
      <div className="card account-card">
        <dl className="specs">
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
      </div>
    </div>
  )
}

export function InfoPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Info</h1>
          <p className="muted">How fills, invoices, and dual payment approval work.</p>
        </div>
      </div>
      <div className="card account-card">
        <p>Bids fill from the last bid per account, highest price first. You only see your own allocated pcs.</p>
        <p>Marketplace checkout creates unpaid invoices. Mark paid and upload a receipt. Admin and super admin both accept before it is paid.</p>
      </div>
    </div>
  )
}

export function Tutorial() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Tutorial</h1>
          <p className="muted">Quick path for a wholesale buyer.</p>
        </div>
      </div>
      <div className="card account-card">
        <ol>
          <li>Open Auction, set qty and price, confirm bid.</li>
          <li>Watch fills on You / Winning amount.</li>
          <li>Buy fixed stock on Marketplace, then Checkout.</li>
          <li>My Page → Invoice: pay and upload receipt.</li>
          <li>Bid History shows Won / Partially Won / Lost after you bid.</li>
        </ol>
      </div>
    </div>
  )
}

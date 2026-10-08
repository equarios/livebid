import { Link } from 'react-router-dom'
import { PublicShell } from '../components/PublicShell'

export function BuyersPage() {
  return (
    <PublicShell>
      <article className="pub-article">
        <p className="kicker">For Buyers</p>
        <h1>Get started sourcing inventory today</h1>
        <p>
          Equarios is a B2B liquidation marketplace connecting returned, overstock, and open-box inventory to wholesale buyers.
          Register free. After approval you can see wholesale prices, bid, and buy.
        </p>
        <ol>
          <li>Create a buyer account and wait for super admin approval.</li>
          <li>Browse All Auctions or Buy Now marketplace listings.</li>
          <li>Set qty and price, then confirm your bid.</li>
          <li>When you win, pay the invoice and upload a receipt.</li>
        </ol>
        <p>
          <Link className="pub-btn pub-btn-fill" to="/register">
            Register Now
          </Link>
        </p>
      </article>
    </PublicShell>
  )
}

export function SellersPage() {
  return (
    <PublicShell>
      <article className="pub-article">
        <p className="kicker">For Sellers</p>
        <h1>Sell excess inventory to verified buyers</h1>
        <p>
          Equarios lists wholesale lots on this marketplace. Admins publish auctions and marketplace stock; super admin controls
          duration, types, and who can bid.
        </p>
        <p>This demo uses admin and super-admin desks rather than a public seller signup.</p>
        <p>
          <Link className="pub-btn" to="/login">
            Sign In
          </Link>
        </p>
      </article>
    </PublicShell>
  )
}

export function SupportPage() {
  return (
    <PublicShell>
      <article className="pub-article">
        <p className="kicker">Support</p>
        <h1>Help for buyers</h1>
        <p>Need a password reset? Use Forgot password on Sign In. This demo shows a one-time code on screen instead of email.</p>
        <p>Invoices stay unpaid until both an admin and a super admin accept your receipt.</p>
        <p>
          <Link to="/login">Sign In</Link>
          {' · '}
          <Link to="/register">Register Now</Link>
        </p>
      </article>
    </PublicShell>
  )
}

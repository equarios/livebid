import { useEffect, useState, type FormEvent } from 'react'
import { InvoiceDesk } from '../components/InvoiceDesk'
import { ListingReview } from '../components/ListingReview'
import { ModalShell } from '../components/ModalShell'
import { TimeLeft } from '../components/TimeLeft'
import { DEFAULT_SETTINGS } from '../data'
import { RESERVED_LIST_SLUGS, slugAuctionType } from '../lib/auctionLists'
import { useNow, useStore } from '../store'
import type { Account, AccountRole, AccountStatus, AuctionFillMode, AuctionTypeDef, FeatureFlags, SiteSettings } from '../types'

const ROLE_LABEL: Record<AccountRole, string> = {
  superadmin: 'Super admin',
  admin: 'Admin',
  member: 'Client',
}

const COPY_LABEL: Record<keyof typeof DEFAULT_SETTINGS.copy, string> = {
  navAuctions: 'Nav · Auctions',
  navFavourites: 'Nav · Favourites',
  navInvoices: 'Nav · Invoices',
  navAccount: 'Nav · Account',
  navAdmin: 'Nav · Admin',
  navSuper: 'Nav · Super admin',
  signOut: 'Sign out button',
  signInTitle: 'Sign in title',
  signInButton: 'Sign in button',
  signUpTitle: 'Sign up title',
  signUpIntro: 'Sign up intro',
  signUpButton: 'Sign up button',
  pendingApproval: 'Pending-approval message',
  auctionsTitle: 'Auctions title',
  auctionsIntro: 'Auctions intro',
  marketTitle: 'Marketplace title',
  marketIntro: 'Marketplace intro',
  favouritesTitle: 'Favourites title',
  favouritesIntro: 'Favourites intro',
  invoicesTitle: 'Invoices title',
  invoicesIntro: 'Invoices intro',
  accountTitle: 'Account title',
  accountIntro: 'Account intro',
  searchAuctions: 'Auction search placeholder',
  searchMarket: 'Marketplace search placeholder',
  emptyFilters: 'Empty filters',
  emptyFavourites: 'Empty favourites',
  emptyCart: 'Empty cart',
  emptyInvoices: 'Empty invoices',
  btnBid: 'Bid button',
  btnTakeAll: 'Take all button',
  btnAddCart: 'Buy / cart button',
  btnBuy: 'Buy button',
  btnOffer: 'Offer button',
  btnCheckout: 'Checkout button',
  btnPay: 'I have paid button',
  btnAccept: 'Accept payment',
  btnDecline: 'Decline payment',
  btnResubmitPay: 'Upload new receipt',
  btnRemove: 'Remove button',
  btnPhotos: 'Photos button',
  btnForgot: 'Forgot-password button',
  btnConfirm: 'Confirm button',
  btnCancel: 'Cancel button',
  confirmBidTitle: 'Popup · bid title',
  confirmBidBody: 'Popup · bid body',
  confirmTakeAllTitle: 'Popup · take-all title',
  confirmTakeAllBody: 'Popup · take-all body ({n} = pcs)',
  confirmCartTitle: 'Popup · buy title',
  confirmCartBody: 'Popup · buy body ({n} = pcs)',
  confirmOfferTitle: 'Popup · send offer title',
  confirmOfferBody: 'Popup · send offer body',
  confirmAcceptOfferTitle: 'Popup · confirm accepted offer',
  confirmAcceptOfferBody: 'Popup · confirm accepted offer body',
  confirmCheckoutTitle: 'Popup · checkout title',
  confirmCheckoutBody: 'Popup · checkout body',
  confirmPayTitle: 'Popup · pay title',
  confirmPayBody: 'Popup · pay body',
  payAckLabel: 'Pay confirm checkbox',
  receiptLabel: 'Receipt upload label',
  payWaiting: 'Waiting dual approval',
  payNeedAdmin: 'Waiting for admin',
  payNeedSuper: 'Waiting for super admin',
  payDeclinedNote: 'Payment declined note',
  confirmForgotTitle: 'Popup · forgot title',
  confirmForgotBody: 'Popup · forgot body',
  favAdd: 'Favourite (off)',
  favRemove: 'Favourite (on)',
  closed: 'Closed label',
  noMoq: 'No-MOQ label',
  cartTitle: 'Cart heading',
  emptyMarket: 'Empty marketplace',
  siteNotice: 'Site-wide notice banner',
  endingSoon: 'Ending-soon warning ({n} = minutes)',
  okAddedCart: 'Success · added to cart ({n})',
  okOffer: 'Success · offer sent',
  okOfferInvoiced: 'Success · offer invoiced',
  okCheckout: 'Success · checkout',
  okBid: 'Success · bid ({qty} {price})',
  okPaid: 'Success · paid',
  okPaySubmitted: 'Success · receipt submitted',
  warnReceipt: 'Warning · receipt required',
  warnPayAck: 'Warning · confirm paid checkbox',
  warnMoq: 'Warning · MOQ ({n} = qty)',
  warnQty: 'Warning · invalid qty',
  warnOverQty: 'Warning · over stock ({n} = qty)',
  warnMinPrice: 'Warning · min price ({price})',
  warnOwnBidLower: 'Warning · cannot reduce own bid ({price})',
  warnStartPrice: 'Warning · offline start price ({price})',
  warnNoBid: 'Warning · bidding off',
  warnPending: 'Warning · pending account',
  warnDisabled: 'Warning · disabled account',
  warnClosed: 'Warning · closed lot',
  warnCart: 'Warning · cart off',
  warnOffers: 'Warning · offers off',
  warnOfferPrice: 'Warning · offer must be below list ({price})',
  warnOfferOpen: 'Warning · accepted offer already open',
  warnLogin: 'Warning · bad login',
  warnRegister: 'Warning · sign-up fields',
  warnAccountTaken: 'Warning · account ID taken',
  warnLotMissing: 'Warning · lot missing',
  warnListingGone: 'Warning · listing gone ({id})',
}

function AddAuctionTypeDialog({
  existing,
  onClose,
  onCreate,
}: {
  existing: string[]
  onClose: () => void
  onCreate: (row: AuctionTypeDef) => void
}) {
  const [label, setLabel] = useState('')
  const [slug, setSlug] = useState('')
  const [fillMode, setFillMode] = useState<AuctionFillMode>('live')
  const [closeMinutes, setCloseMinutes] = useState(240)
  const [error, setError] = useState<string | null>(null)
  const value = slugAuctionType(slug || label)

  function submit() {
    const name = label.trim() || value.replace(/-/g, ' ')
    if (!value) {
      setError('Enter a name for this auction type.')
      return
    }
    if (RESERVED_LIST_SLUGS.has(value)) {
      setError(`“${value}” is reserved. Use another name.`)
      return
    }
    if (existing.includes(value)) {
      setError(`“${value}” already exists.`)
      return
    }
    const mins = Math.max(1, Math.floor(closeMinutes) || 240)
    onCreate({
      value,
      label: name,
      fillMode,
      closeMinutes: mins,
      closesAt: Date.now() + mins * 60 * 1000,
    })
  }

  return (
    <ModalShell onClose={onClose}>
      <div
        className="modal card type-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-auction-type-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-auction-type-title">Add auction type</h2>
        <p className="muted">Creates its own inventory list. Buyers open it from Auctions like Live Auctions or Offline Auctions.</p>
        <label>
          Type name
          <input
            autoFocus
            value={label}
            placeholder="Dutch auction"
            onChange={(e) => {
              setLabel(e.target.value)
              setError(null)
            }}
          />
        </label>
        <label>
          List id (URL)
          <input
            value={slug}
            placeholder={value || 'dutch'}
            onChange={(e) => {
              setSlug(e.target.value)
              setError(null)
            }}
          />
        </label>
        <p className="muted tiny">Section on auctions: /auctions#{value || '…'}</p>
        <label>
          Fill mode
          <select value={fillMode} onChange={(e) => setFillMode(e.target.value as AuctionFillMode)}>
            <option value="live">Live fill</option>
            <option value="sealed">Sealed (hidden fill)</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </label>
        <label>
          Default close (minutes)
          <input
            type="number"
            min={1}
            value={closeMinutes}
            onChange={(e) => setCloseMinutes(Number(e.target.value))}
          />
        </label>
        <p className="muted tiny">First session starts now for that long. Later publishes join the open clock.</p>
        {error ? <p className="error">{error}</p> : null}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit}>
            Add auction type
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

export function Super() {
  const { accounts, invoices, lots, listingDrops, settings, saveSettings, saveAccount, removeAccount, setAccountStatus } =
    useStore()
  const now = useNow()
  const [draft, setDraft] = useState<SiteSettings>(settings)
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null)
  const [addTypeOpen, setAddTypeOpen] = useState(false)
  const [accountMsg, setAccountMsg] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState('')
  const [company, setCompany] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<AccountRole>('member')
  const [status, setStatus] = useState<AccountStatus>('active')

  const pending = accounts.filter((a) => a.status === 'pending')
  const payRequests = invoices.filter((i) => i.status === 'pending_review')
  const issueWait = invoices.filter((i) => i.status === 'draft')
  const catalogWait = (listingDrops || []).filter((d) => d.status === 'pending')
  const [tab, setTab] = useState<
    'confirm' | 'people' | 'payments' | 'site' | 'copy' | 'features' | 'types'
  >(catalogWait.length ? 'confirm' : issueWait.length || payRequests.length ? 'payments' : 'people')

  useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      auctionTypes: settings.auctionTypes.map((live) => {
        const d = prev.auctionTypes.find((x) => x.value === live.value)
        if (!d) return live
        return {
          ...live,
          label: d.label,
          fillMode: d.fillMode,
          intro: d.intro,
          closeMinutes: d.closeMinutes,
        }
      }),
    }))
  }, [settings.auctionTypes])

  function publishAuctionType(row: AuctionTypeDef) {
    const auctionTypes = [...settings.auctionTypes.filter((t) => t.value !== row.value), row]
    saveSettings({ ...settings, auctionTypes })
    setDraft((prev) => ({ ...prev, auctionTypes }))
    setAddTypeOpen(false)
    setTab('types')
    setSettingsMsg(`${row.label} is live. Buyers see it under Auctions.`)
  }

  function resetAccountForm() {
    setEditingId(null)
    setAccountId('')
    setCompany('')
    setAddress('')
    setEmail('')
    setPassword('')
    setRole('member')
    setStatus('active')
  }

  function loadAccount(a: Account) {
    setEditingId(a.accountId)
    setAccountId(a.accountId)
    setCompany(a.company)
    setAddress(a.address || '')
    setEmail(a.email)
    setPassword('')
    setRole(a.role === 'superadmin' ? 'superadmin' : a.role)
    setStatus(a.status)
    setAccountMsg(`Editing ${a.accountId}`)
  }

  function onSaveAccount(e: FormEvent) {
    e.preventDefault()
    const err = saveAccount({
      accountId: editingId || accountId,
      company,
      address,
      email,
      password,
      role: editingId === 'SUPER-0001' ? 'superadmin' : role === 'admin' ? 'admin' : 'member',
      status,
    })
    if (err) {
      setAccountMsg(err)
      return
    }
    setAccountMsg(editingId ? `Saved ${editingId}` : `Created ${accountId.toUpperCase()}`)
    resetAccountForm()
  }

  function onSaveSettings(e: FormEvent, clocks: 'keep' | 'draft' = 'keep') {
    e.preventDefault()
    const grades = draft.grades.map((g) => g.trim()).filter(Boolean)
    if (!draft.brandName.trim() || !grades.length) {
      setSettingsMsg('Brand name and at least one grade are required.')
      return
    }
    if (!draft.auctionTypes.length) {
      setSettingsMsg('Keep at least one auction type.')
      return
    }
    saveSettings({
      ...draft,
      brandName: draft.brandName.trim(),
      brandMark: draft.brandMark.trim() || 'EQ',
      brandLogo: draft.brandLogo.trim() || '/equarios-logo.png',
      tagline: draft.tagline.trim(),
      marketplaceLabel: draft.marketplaceLabel.trim() || 'Marketplace',
      grades,
      auctionTypes: clocks === 'keep' ? settings.auctionTypes : draft.auctionTypes,
      defaultMoq: Math.max(0, Math.floor(Number(draft.defaultMoq) || 0)),
      reopenMinutes: Math.max(1, Math.floor(Number(draft.reopenMinutes ?? (draft.reopenHours || 4) * 60) || 1)),
      extendMinutes: Math.max(1, Math.floor(Number(draft.extendMinutes ?? (draft.extendHours || 2) * 60) || 1)),
      reopenHours: Math.max(1 / 60, Number(draft.reopenMinutes ?? (draft.reopenHours || 4) * 60) / 60),
      extendHours: Math.max(1 / 60, Number(draft.extendMinutes ?? (draft.extendHours || 2) * 60) / 60),
      endingSoonMinutes: Math.max(1, Math.floor(Number(draft.endingSoonMinutes) || 15)),
    })
    setSettingsMsg(
      clocks === 'draft'
        ? 'Auction types saved. Open lists keep their current close unless you started a new clock.'
        : 'Settings saved. Auction close times were left unchanged.',
    )
  }

  return (
    <div className="staff-page">
      <div className="auction-desk">
        <div className="auction-desk-head">
          <div>
            <strong>Super admin</strong>
            <p className="muted tiny auction-desk-recap">
              Confirmations and site control. Admin lists stock and stamps receipts; you publish catalogs, final-confirm
              payments, and own accounts plus settings.
            </p>
          </div>
          {tab === 'types' ? (
            <div className="auction-desk-head-actions">
              <button type="button" className="btn btn-primary" onClick={() => setAddTypeOpen(true)}>
                Add auction type
              </button>
            </div>
          ) : null}
        </div>
        <div className="super-tabs staff-tabs">
          {(
            [
              ['confirm', catalogWait.length ? `Confirm (${catalogWait.reduce((n, d) => n + d.items.length, 0)})` : 'Confirm'],
              [
                'payments',
                issueWait.length || payRequests.length
                  ? `Invoices (${issueWait.length + payRequests.length})`
                  : 'Invoices',
              ],
              ['people', pending.length ? `Accounts (${pending.length})` : 'Accounts'],
              ['site', 'Site'],
              ['types', 'Auction types'],
              ['copy', 'Text'],
              ['features', 'Functions'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`btn btn-ghost ${tab === id ? 'on' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'people' ? <section className="card admin-section">
        <h2>{editingId ? `Edit ${editingId}` : 'Add admin or client'}</h2>
        <form className="admin-form" onSubmit={onSaveAccount}>
          <label>
            Account ID
            <input
              value={accountId}
              disabled={Boolean(editingId)}
              onChange={(e) => setAccountId(e.target.value)}
            />
          </label>
          <label>
            Company
            <input value={company} onChange={(e) => setCompany(e.target.value)} />
          </label>
          <label className="admin-span">
            Ship / bill address
            <textarea rows={3} value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password {editingId ? '(blank = keep)' : ''}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label>
            Role
            <select
              value={role === 'superadmin' ? 'superadmin' : role}
              disabled={role === 'superadmin'}
              onChange={(e) => setRole(e.target.value as AccountRole)}
            >
              <option value="member">Client</option>
              <option value="admin">Admin</option>
              {role === 'superadmin' ? <option value="superadmin">Super admin</option> : null}
            </select>
          </label>
          <label>
            Status
            <select
              value={status}
              disabled={role === 'superadmin'}
              onChange={(e) => setStatus(e.target.value as AccountStatus)}
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <button className="btn btn-primary" type="submit">
            {editingId ? 'Save account' : 'Add account'}
          </button>
          {editingId ? (
            <button type="button" className="btn btn-ghost" onClick={resetAccountForm}>
              Cancel
            </button>
          ) : null}
        </form>
        {accountMsg ? <p className={accountMsg.includes('Only') || accountMsg.includes('cannot') || accountMsg.includes('Fill') || accountMsg.includes('Password') ? 'error' : 'ok'}>{accountMsg}</p> : null}
      </section> : null}

      {tab === 'people' ? <section className="table-wrap card admin-section">
        <h2>All accounts</h2>
        <table className="auction-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Role</th>
              <th>Status</th>
              <th>Company</th>
              <th>Email</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.accountId}>
                <td className="mono">{a.accountId}</td>
                <td>{ROLE_LABEL[a.role]}</td>
                <td>
                  <span className={`pill ${a.status === 'active' ? 'pill-market' : a.status === 'pending' ? 'pill-hybrid' : 'pill-sealed'}`}>
                    {a.status}
                  </span>
                </td>
                <td>{a.company}</td>
                <td>{a.email}</td>
                <td className="row-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => loadAccount(a)}>
                    Edit
                  </button>
                  {a.status === 'pending' ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setAccountStatus(a.accountId, 'active')}
                    >
                      Approve
                    </button>
                  ) : null}
                  {a.role !== 'superadmin' ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        if (window.confirm(`Remove ${a.accountId}?`)) {
                          const err = removeAccount(a.accountId)
                          if (err) setAccountMsg(err)
                        }
                      }}
                    >
                      Remove
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section> : null}

      {tab === 'confirm' ? <ListingReview /> : null}

      {tab === 'payments' ? (
        <section className="card admin-section pay-queue-card">
          <h2>Issue invoices &amp; payment confirmations</h2>
          <InvoiceDesk canSuper allowCreate={false} />
        </section>
      ) : null}

      {tab === 'site' ? (
        <section className="card admin-section">
          <h2>Site</h2>
          <form className="admin-form" onSubmit={(e) => onSaveSettings(e, 'keep')}>
            <label>
              Brand name
              <input
                value={draft.brandName}
                onChange={(e) => setDraft({ ...draft, brandName: e.target.value })}
              />
            </label>
            <label>
              Brand mark
              <input
                value={draft.brandMark}
                onChange={(e) => setDraft({ ...draft, brandMark: e.target.value })}
              />
            </label>
            <label className="admin-span">
              Brand logo
              <input
                value={draft.brandLogo}
                onChange={(e) => setDraft({ ...draft, brandLogo: e.target.value })}
              />
            </label>
            <label>
              Tagline
              <input
                value={draft.tagline}
                onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
              />
            </label>
            <label>
              Marketplace label
              <input
                value={draft.marketplaceLabel}
                onChange={(e) => setDraft({ ...draft, marketplaceLabel: e.target.value })}
              />
            </label>
            <label>
              Grades (comma separated)
              <input
                value={draft.grades.join(', ')}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    grades: e.target.value.split(',').map((g) => g.trim()).filter(Boolean),
                  })
                }
              />
            </label>
            <label>
              Default MOQ (0 = none)
              <input
                type="number"
                min={0}
                value={draft.defaultMoq}
                onChange={(e) => setDraft({ ...draft, defaultMoq: Number(e.target.value) })}
              />
            </label>
            <label>
              Reopen minutes
              <input
                type="number"
                min={1}
                step={1}
                value={draft.reopenMinutes ?? Math.round((draft.reopenHours || 4) * 60)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    reopenMinutes: Number(e.target.value),
                    reopenHours: Number(e.target.value) / 60,
                  })
                }
              />
            </label>
            <label>
              Extend minutes
              <input
                type="number"
                min={1}
                step={1}
                value={draft.extendMinutes ?? Math.round((draft.extendHours || 2) * 60)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    extendMinutes: Number(e.target.value),
                    extendHours: Number(e.target.value) / 60,
                  })
                }
              />
            </label>
            <label className="admin-span">
              Invoice legal name
              <input
                value={draft.invoice.legalName}
                onChange={(e) => setDraft({ ...draft, invoice: { ...draft.invoice, legalName: e.target.value } })}
              />
            </label>
            <label className="admin-span">
              Invoice address
              <textarea
                rows={3}
                value={draft.invoice.address}
                onChange={(e) => setDraft({ ...draft, invoice: { ...draft.invoice, address: e.target.value } })}
              />
            </label>
            <label>
              Invoice tel
              <input
                value={draft.invoice.tel}
                onChange={(e) => setDraft({ ...draft, invoice: { ...draft.invoice, tel: e.target.value } })}
              />
            </label>
            <label>
              Terms
              <input
                value={draft.invoice.terms}
                onChange={(e) => setDraft({ ...draft, invoice: { ...draft.invoice, terms: e.target.value } })}
              />
            </label>
            <label>
              Pay days
              <input
                type="number"
                min={1}
                value={draft.invoice.payDays}
                onChange={(e) =>
                  setDraft({ ...draft, invoice: { ...draft.invoice, payDays: Number(e.target.value) } })
                }
              />
            </label>
            <label>
              Optional fee % (admin applies per invoice)
              <input
                type="number"
                min={0}
                step={0.1}
                value={draft.invoice.feePct}
                onChange={(e) =>
                  setDraft({ ...draft, invoice: { ...draft.invoice, feePct: Number(e.target.value) } })
                }
              />
            </label>
            <label>
              SWIFT
              <input
                value={draft.invoice.swift}
                onChange={(e) => setDraft({ ...draft, invoice: { ...draft.invoice, swift: e.target.value } })}
              />
            </label>
            <label className="admin-span">
              Bank name
              <input
                value={draft.invoice.bankName}
                onChange={(e) => setDraft({ ...draft, invoice: { ...draft.invoice, bankName: e.target.value } })}
              />
            </label>
            <label>
              Branch
              <input
                value={draft.invoice.branchName}
                onChange={(e) => setDraft({ ...draft, invoice: { ...draft.invoice, branchName: e.target.value } })}
              />
            </label>
            <label className="admin-span">
              Branch address
              <input
                value={draft.invoice.branchAddress}
                onChange={(e) =>
                  setDraft({ ...draft, invoice: { ...draft.invoice, branchAddress: e.target.value } })
                }
              />
            </label>
            <label>
              Account number
              <input
                value={draft.invoice.accountNumber}
                onChange={(e) =>
                  setDraft({ ...draft, invoice: { ...draft.invoice, accountNumber: e.target.value } })
                }
              />
            </label>
            <label className="admin-span">
              Beneficiary
              <input
                value={draft.invoice.beneficiary}
                onChange={(e) => setDraft({ ...draft, invoice: { ...draft.invoice, beneficiary: e.target.value } })}
              />
            </label>
            <label>
              Ending-soon minutes
              <input
                type="number"
                min={1}
                value={draft.endingSoonMinutes}
                onChange={(e) => setDraft({ ...draft, endingSoonMinutes: Number(e.target.value) })}
              />
            </label>
            {(
              [
                ['navy', 'Primary'],
                ['navy2', 'Primary dark'],
                ['ink', 'Text'],
                ['muted', 'Muted text'],
                ['line', 'Lines'],
                ['bg', 'Background'],
                ['card', 'Cards'],
                ['win', 'Win / paid'],
                ['lose', 'Error / unpaid'],
                ['live', 'Brand teal / live'],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="color"
                  value={draft.theme[key]}
                  onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, [key]: e.target.value } })}
                />
              </label>
            ))}
            <label>
              Font
              <input
                value={draft.theme.font}
                onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, font: e.target.value } })}
              />
            </label>
            <label>
              Corner radius
              <input
                value={draft.theme.radius}
                onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, radius: e.target.value } })}
              />
            </label>
            <label>
              Favourite icon
              <input
                value={draft.icons.favourite}
                onChange={(e) => setDraft({ ...draft, icons: { favourite: e.target.value } })}
              />
            </label>
            <fieldset className="admin-toggles">
              <legend>Pages</legend>
              <label>
                <input
                  type="checkbox"
                  checked={draft.showAuctions}
                  onChange={(e) => setDraft({ ...draft, showAuctions: e.target.checked })}
                />
                Auctions
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.showMarketplace}
                  onChange={(e) => setDraft({ ...draft, showMarketplace: e.target.checked })}
                />
                Marketplace
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.showFavourites}
                  onChange={(e) => setDraft({ ...draft, showFavourites: e.target.checked })}
                />
                Favourites
              </label>
            </fieldset>
            <fieldset className="admin-toggles">
              <legend>Filters clients see</legend>
              {(['maker', 'grade', 'capacity'] as const).map((key) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={draft.filters[key]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        filters: { ...draft.filters, [key]: e.target.checked },
                      })
                    }
                  />
                  {key[0].toUpperCase() + key.slice(1)}
                </label>
              ))}
            </fieldset>
            <button className="btn btn-primary" type="submit">
              Save site
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() =>
                setDraft({
                  ...draft,
                  theme: { ...DEFAULT_SETTINGS.theme },
                  icons: { ...DEFAULT_SETTINGS.icons },
                })
              }
            >
              Reset colors
            </button>
          </form>
          {settingsMsg ? <p className="ok">{settingsMsg}</p> : null}
        </section>
      ) : null}

      {tab === 'copy' ? (
        <section className="card admin-section">
          <h2>Text, buttons &amp; warnings</h2>
          <form className="admin-form" onSubmit={(e) => onSaveSettings(e, 'keep')}>
            {(Object.keys(DEFAULT_SETTINGS.copy) as Array<keyof typeof DEFAULT_SETTINGS.copy>).map((key) => (
              <label key={key} className={draft.copy[key].length > 48 ? 'admin-span' : undefined}>
                {COPY_LABEL[key]}
                <input
                  value={draft.copy[key]}
                  onChange={(e) =>
                    setDraft({ ...draft, copy: { ...draft.copy, [key]: e.target.value } })
                  }
                />
              </label>
            ))}
            <button className="btn btn-primary" type="submit">
              Save text
            </button>
          </form>
          {settingsMsg ? <p className="ok">{settingsMsg}</p> : null}
        </section>
      ) : null}

      {tab === 'features' ? (
        <section className="card admin-section">
          <h2>Functions clients can use</h2>
          <form
            className="admin-form"
            onSubmit={(e) => onSaveSettings(e, 'keep')}
          >
            <fieldset className="admin-toggles">
              <legend>Client actions</legend>
              {(
                [
                  ['bidding', 'Bidding'],
                  ['takeAll', 'Take all'],
                  ['favourites', 'Favourites'],
                  ['cart', 'Marketplace cart'],
                  ['offers', 'Marketplace offers'],
                  ['register', 'Public sign-up'],
                  ['forgotPassword', 'Forgot-password popup'],
                  ['bots', 'Live bid bots (demo)'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={draft.features[key]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        features: { ...draft.features, [key]: e.target.checked } as FeatureFlags,
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <fieldset className="admin-toggles">
              <legend>Pop-ups before money / qty</legend>
              {(
                [
                  ['confirmBid', 'Confirm bid'],
                  ['confirmTakeAll', 'Confirm take all'],
                  ['confirmCart', 'Confirm add to cart'],
                  ['confirmCheckout', 'Confirm checkout'],
                  ['confirmPay', 'Confirm mark paid'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={draft.features[key]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        features: { ...draft.features, [key]: e.target.checked } as FeatureFlags,
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <fieldset className="admin-toggles">
              <legend>Warnings</legend>
              {(
                [
                  ['siteNotice', 'Site notice banner'],
                  ['endingSoon', 'Ending-soon warning'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={draft.features[key]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        features: { ...draft.features, [key]: e.target.checked } as FeatureFlags,
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <button className="btn btn-primary" type="submit">
              Save functions
            </button>
          </form>
          {settingsMsg ? <p className="ok">{settingsMsg}</p> : null}
        </section>
      ) : null}

      {tab === 'types' ? (
        <section className="card admin-section">
          <h2>Auction types</h2>
          <p className="muted tiny">Each type is a list on Auctions. This is the only place to add or edit types.</p>
          <form className="admin-form" onSubmit={(e) => onSaveSettings(e, 'draft')}>
          <div className="type-manager admin-span">
            <p className="muted tiny">
              Live Auctions and Offline Auctions are the main lists. Default minutes apply when a closed list is
              published again. Saving labels does not move an open clock.
            </p>
            <div className="type-rows">
              {draft.auctionTypes.map((t, i) => {
                const inUse = lots.some((l) => l.channel === 'auction' && (l.auctionType || 'live') === t.value)
                return (
                  <div className="type-row" key={t.value}>
                    <label>
                      List id
                      <input value={t.value} readOnly title="Id is the URL slug and cannot change after create" />
                    </label>
                    <label>
                      Label
                      <input
                        value={t.label}
                        onChange={(e) => {
                          const auctionTypes = draft.auctionTypes.map((row, idx) =>
                            idx === i ? { ...row, label: e.target.value } : row,
                          )
                          setDraft({ ...draft, auctionTypes })
                        }}
                      />
                    </label>
                    <label>
                      Default close (min)
                      <input
                        type="number"
                        min={1}
                        value={t.closeMinutes || 240}
                        onChange={(e) => {
                          const mins = Math.max(1, Math.floor(Number(e.target.value) || 1))
                          const auctionTypes = draft.auctionTypes.map((row, idx) =>
                            idx === i ? { ...row, closeMinutes: mins } : row,
                          )
                          setDraft({ ...draft, auctionTypes })
                        }}
                      />
                    </label>
                    <div>
                      <span className="muted tiny">Current close</span>
                      <div className="type-row-actions">
                        {t.closesAt && t.closesAt > now ? (
                          <TimeLeft endsAt={t.closesAt} closedLabel="Closed" />
                        ) : (
                          <span className="muted tiny">Closed</span>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            const mins = Math.max(1, t.closeMinutes || 240)
                            const auctionTypes = draft.auctionTypes.map((row, idx) =>
                              idx === i
                                ? { ...row, closeMinutes: mins, closesAt: Date.now() + mins * 60 * 1000 }
                                : row,
                            )
                            setDraft({ ...draft, auctionTypes })
                          }}
                        >
                          Start clock now
                        </button>
                      </div>
                    </div>
                    <label>
                      Fill mode
                      <select
                        value={t.fillMode || 'live'}
                        onChange={(e) => {
                          const fillMode = e.target.value as AuctionFillMode
                          const auctionTypes = draft.auctionTypes.map((row, idx) =>
                            idx === i ? { ...row, fillMode } : row,
                          )
                          setDraft({ ...draft, auctionTypes })
                        }}
                      >
                        <option value="live">Live fill</option>
                        <option value="sealed">Sealed (hidden fill)</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </label>
                    <div className="type-row-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={i === 0}
                        onClick={() => {
                          const auctionTypes = [...draft.auctionTypes]
                          ;[auctionTypes[i - 1], auctionTypes[i]] = [auctionTypes[i], auctionTypes[i - 1]]
                          setDraft({ ...draft, auctionTypes })
                        }}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={i === draft.auctionTypes.length - 1}
                        onClick={() => {
                          const auctionTypes = [...draft.auctionTypes]
                          ;[auctionTypes[i + 1], auctionTypes[i]] = [auctionTypes[i], auctionTypes[i + 1]]
                          setDraft({ ...draft, auctionTypes })
                        }}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={draft.auctionTypes.length < 2 || inUse}
                        title={inUse ? 'Lots still use this type' : 'Remove type'}
                        onClick={() => {
                          if (draft.auctionTypes.length < 2 || inUse) return
                          setDraft({
                            ...draft,
                            auctionTypes: draft.auctionTypes.filter((_, idx) => idx !== i),
                          })
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    <label className="admin-span">
                      List intro
                      <input
                        value={t.intro || ''}
                        placeholder="Shown under the list title"
                        onChange={(e) => {
                          const auctionTypes = draft.auctionTypes.map((row, idx) =>
                            idx === i ? { ...row, intro: e.target.value } : row,
                          )
                          setDraft({ ...draft, auctionTypes })
                        }}
                      />
                    </label>
                  </div>
                )
              })}
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setAddTypeOpen(true)}>
              Add auction type
            </button>
          </div>
            <button className="btn btn-primary" type="submit">Save types</button>
          </form>
          {settingsMsg ? <p className="ok">{settingsMsg}</p> : null}
        </section>
      ) : null}

      {addTypeOpen ? (
        <AddAuctionTypeDialog
          existing={settings.auctionTypes.map((t) => t.value)}
          onClose={() => setAddTypeOpen(false)}
          onCreate={publishAuctionType}
        />
      ) : null}
    </div>
  )
}

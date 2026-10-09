import { DEFAULT_SETTINGS } from '../data'
import {
  boxNoForLot,
  buyerNumber,
  fillInvoiceTemplate,
  invoiceDueAt,
  invoiceLines,
  invoicePayDays,
  invoiceTotals,
  itemDescription,
} from './invoices'
import { invoiceSlashDate as slashDate, moneyUsd } from './format'
import type { Account, Invoice, Lot, SiteSettings } from '../types'

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function nl(value: string) {
  return esc(value).replace(/\n/g, '<br>')
}

function contactLine(parts: Array<{ label: string; value?: string }>, opts?: { showEmpty?: boolean }) {
  const bits = parts
    .map((p) => {
      const v = p.value?.trim()
      if (!v && !opts?.showEmpty) return ''
      return `<span class="inv-cbit"><span class="inv-clab">${esc(p.label)}</span> ${esc(v || '—')}</span>`
    })
    .filter(Boolean)
  return bits.length ? `<div class="inv-contacts">${bits.join('')}</div>` : ''
}

/** Commercial invoice HTML — clean A4 wholesale layout (print + in-app preview). */
export function invoiceDocHtml(
  inv: Invoice,
  lots: Lot[],
  buyer: Account | undefined,
  settings: SiteSettings,
) {
  const profile = { ...DEFAULT_SETTINGS.invoice, ...settings.invoice }
  const currency = (profile.currency || 'USD').trim() || 'USD'
  const lotById = new Map(lots.map((l) => [l.id, l]))
  const lines = invoiceLines(inv)
  const totals = invoiceTotals(inv, settings)
  const issued = inv.issuedAt || inv.createdAt
  const fallbackCompany = (buyer?.company || inv.accountId || 'Client').trim()
  const fallbackAddr = buyer?.address?.trim() || ''
  const shipCompany = (inv.shipCompany || fallbackCompany).trim()
  const shipAddr = (inv.shipAddress || fallbackAddr).trim()
  const billCompany = (inv.billCompany || fallbackCompany).trim()
  const billAddr = (inv.billAddress || fallbackAddr).trim()
  const terms = (inv.terms || profile.terms || 'EX Works').trim()
  const logo = settings.brandLogo
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${settings.brandLogo}`
    : ''
  const admin = inv.issueAdmin?.decision === 'accepted' ? inv.issueAdmin.by : ''
  const superBy = inv.issueSuper?.decision === 'accepted' ? inv.issueSuper.by : ''
  const payDays = invoicePayDays(settings)
  const due = slashDate(invoiceDueAt(inv, settings))
  const feeOn = totals.feePct > 0
  const tplVars = { payDays, feePct: totals.feePct }
  const money = (n: number) => moneyUsd(n, currency)
  const currMark = currency === 'USD' ? 'USD' : currency

  const bodyRows = lines
    .map((line, i) => {
      const lot = lotById.get(line.lotId)
      const goods = line.unitPrice * line.qty
      const sim = line.sim || (lot ? (lot.simLocked ? 'Locked' : 'Unlocked') : 'Unlocked')
      const grade = line.grade || lot?.grade || '—'
      return `<tr>
        <td class="c">${i + 1}</td>
        <td class="desc">${esc(itemDescription(lot, line.lotId, line.description))}</td>
        <td class="box">${esc(boxNoForLot(line.lotId, line.boxNo) || '—')}</td>
        <td class="c">${esc(sim)}</td>
        <td class="c">${esc(grade)}</td>
        <td class="num">${line.qty.toLocaleString('en-US')}</td>
        <td class="num">${money(line.unitPrice)}</td>
        <td class="num amt">${money(goods)}</td>
      </tr>`
    })
    .join('')

  const partyBlock = (
    label: string,
    name: string,
    addr: string,
    extras?: { email?: string; phone?: string; attn?: string; buyerNo?: string },
  ) =>
    `<div class="inv-party">
      <div class="inv-party-lab">${esc(label)}</div>
      <div class="inv-party-name">${esc(name || '—')}</div>
      ${extras?.attn?.trim() ? `<div class="inv-party-attn">Attn: ${esc(extras.attn.trim())}</div>` : ''}
      <div class="inv-party-addr${addr.trim() ? '' : ' is-muted'}">${addr.trim() ? nl(addr) : 'Address on file'}</div>
      ${contactLine(
        [
          { label: 'Tel', value: extras?.phone },
          { label: 'Email', value: extras?.email },
          ...(extras?.buyerNo != null
            ? [{ label: 'Buyer #', value: extras.buyerNo }]
            : []),
        ],
        { showEmpty: true },
      )}
    </div>`

  const showStamps = Boolean(admin || superBy || inv.status === 'draft' || inv.status === 'unpaid')

  /* Class names use inv-* so in-app preview CSS never clashes with site .brand etc. */
  return `<!doctype html><html><head><meta charset="utf-8"><title>invoice_${esc(inv.id)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #1a2330;
    font: 11px/1.45 "Segoe UI", system-ui, -apple-system, sans-serif;
    background: #fff;
    -webkit-font-smoothing: antialiased;
  }
  .inv-doc { width: 100%; max-width: 186mm; margin: 0 auto; color: #1a2330; }
  .inv-top {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(168px, 0.85fr);
    gap: 16px 24px;
    align-items: start;
    padding-bottom: 14px;
    border-bottom: 2px solid #1a2330;
    margin-bottom: 14px;
  }
  .inv-brand {
    min-width: 0;
    max-width: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    white-space: normal;
  }
  .inv-logo {
    height: 100px;
    max-width: 130px;
    width: auto;
    max-height: 100px;
    object-fit: contain;
    object-position: left center;
    margin: 0 0 6px;
    display: block;
  }
  .inv-issuer {
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.01em;
    margin: 0 0 6px;
    color: #1a2330;
    white-space: normal;
  }
  .inv-addr {
    color: #5c6670;
    white-space: pre-line;
    font-size: 10px;
    line-height: 1.5;
    margin: 0;
    max-width: 100%;
    overflow-wrap: anywhere;
  }
  .inv-contacts {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 14px;
    margin-top: 8px;
    font-size: 9.5px;
    color: #44505e;
    line-height: 1.45;
    width: 100%;
    white-space: normal;
  }
  .inv-cbit { white-space: nowrap; }
  .inv-clab { color: #7a8490; font-weight: 600; margin-right: 3px; }
  .inv-meta { min-width: 0; width: 100%; }
  .inv-title {
    font-size: 22px; font-weight: 750; letter-spacing: 0.06em;
    text-transform: uppercase; margin: 0 0 10px; text-align: right;
  }
  .inv-meta-grid {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 4px 12px;
    font-size: 11px;
  }
  .inv-meta-grid .k { color: #6a7380; }
  .inv-meta-grid .v { font-weight: 650; text-align: right; word-break: break-word; }
  .inv-meta-grid .v.strong { font-size: 13px; font-weight: 800; }

  .inv-pay-row {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
    gap: 12px;
    margin: 14px 0 0;
    align-items: stretch;
  }
  .inv-pay, .inv-terms {
    padding: 10px 12px;
    border: 1px solid #d5dbe3;
    border-radius: 4px;
    background: #f7f9fb;
    min-width: 0;
  }
  .inv-pay-lab, .inv-terms-lab {
    font-size: 9.5px; font-weight: 700; letter-spacing: 0.06em;
    text-transform: uppercase; color: #6a7380; margin: 0 0 6px;
  }
  .inv-pay-lead { margin: 0 0 8px; color: #44505e; font-size: 10.5px; }
  .inv-pay-grid {
    display: grid;
    grid-template-columns: 88px minmax(0, 1fr);
    gap: 3px 8px;
    font-size: 10.5px;
  }
  .inv-pay-grid .lab { color: #6a7380; }
  .inv-pay-grid .val { font-weight: 600; overflow-wrap: anywhere; }
  .inv-pay-branch { grid-column: 2; color: #6a7380; font-size: 10px; margin: -1px 0 2px; }
  .inv-pay-note { font-size: 10px; color: #6a7380; margin: 8px 0 0; }
  .inv-terms-body {
    margin: 0;
    font-size: 11px;
    line-height: 1.45;
    color: #1a2330;
    font-weight: 600;
  }
  .inv-terms-due {
    margin: 10px 0 0;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 4px 10px;
    font-size: 10.5px;
  }
  .inv-terms-due .k { color: #6a7380; }
  .inv-terms-due .v { font-weight: 700; text-align: right; }

  table.inv-items { width: 100%; border-collapse: collapse; margin-top: 2px; }
  table.inv-items th, table.inv-items td {
    border-bottom: 1px solid #d5dbe3;
    padding: 6px 5px;
    font-size: 10px;
    vertical-align: middle;
  }
  table.inv-items th {
    border-top: 1px solid #1a2330;
    border-bottom: 1px solid #1a2330;
    background: #f0f3f6;
    font-weight: 700;
    text-align: center;
    font-size: 9.5px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: #44505e;
  }
  table.inv-items td.c, table.inv-items th.c { text-align: center; }
  table.inv-items td.num, table.inv-items th.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  table.inv-items td.amt { font-weight: 700; }
  table.inv-items td.desc { text-align: left; }
  table.inv-items td.box { white-space: nowrap; color: #44505e; }
  table.inv-items tbody tr:last-child td { border-bottom: 1px solid #1a2330; }

  .inv-attach { margin: 8px 0 6px; font-size: 10px; color: #6a7380; }

  .inv-sums-wrap { display: flex; justify-content: flex-end; margin-top: 8px; }
  .inv-sums { width: min(280px, 100%); border-collapse: collapse; }
  .inv-sums td { padding: 3px 0; font-size: 11px; }
  .inv-sums .lab { text-align: left; color: #44505e; }
  .inv-sums .amt {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 650;
    padding-left: 16px;
  }
  .inv-sums .grand td {
    font-size: 13px; font-weight: 800; color: #1a2330;
    border-top: 2px solid #1a2330; padding-top: 6px;
  }
  .inv-tiny { font-size: 10px; color: #6a7380; margin: 8px 0 0; }

  .inv-parties {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 16px 20px;
    margin: 0 0 14px;
    padding: 12px 0;
    border-bottom: 1px solid #d5dbe3;
  }
  .inv-party { min-width: 0; }
  .inv-party-lab {
    font-size: 9.5px; font-weight: 700; letter-spacing: 0.06em;
    text-transform: uppercase; color: #6a7380; margin-bottom: 4px;
  }
  .inv-party-name { font-weight: 700; font-size: 12px; white-space: normal; }
  .inv-party-attn { margin-top: 2px; font-size: 10px; color: #44505e; }
  .inv-party-addr { margin-top: 3px; color: #44505e; font-size: 10.5px; line-height: 1.45; overflow-wrap: anywhere; }
  .inv-party-addr.is-muted { color: #9aa3ad; }
  .inv-party .inv-contacts { margin-top: 6px; }

  .inv-remarks {
    margin-top: 10px;
    padding: 8px 12px;
    background: #fafbfc;
    border-left: 3px solid #c5ced8;
    font-size: 10px;
    color: #44505e;
  }
  .inv-remarks p { margin: 0 0 3px; }
  .inv-remarks p:last-child { margin-bottom: 0; }

  .inv-stamps {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 18px;
  }
  .inv-stamp {
    border: 1px solid #d5dbe3;
    border-radius: 4px;
    padding: 10px 12px;
    font-size: 10px;
    color: #6a7380;
    min-height: 52px;
  }
  .inv-stamp strong { display: block; color: #1a2330; margin-bottom: 4px; font-size: 10.5px; }

  .inv-foot {
    margin-top: 20px;
    text-align: center;
    font-size: 9.5px;
    color: #9aa3ad;
    letter-spacing: 0.04em;
  }
  @media print {
    .noprint { display: none !important; }
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
  @media (max-width: 640px) {
    .inv-top, .inv-parties, .inv-pay-row { grid-template-columns: 1fr; }
    .inv-title { text-align: left; }
  }
</style></head><body><div class="inv-doc">
  <div class="inv-top">
    <div class="inv-brand">
      ${logo ? `<img class="inv-logo" src="${esc(logo)}" alt="${esc(profile.legalName)}">` : ''}
      <div class="inv-issuer">${esc(profile.legalName)}</div>
      <div class="inv-addr">${nl(profile.address)}</div>
      ${contactLine([
        { label: 'Tel', value: profile.tel },
        { label: 'Email', value: profile.email },
        { label: 'Web', value: profile.website },
      ])}
    </div>
    <div class="inv-meta">
      <div class="inv-title">Invoice</div>
      <div class="inv-meta-grid">
        <span class="k">Date</span><span class="v">${slashDate(issued)}</span>
        <span class="k">Invoice #</span><span class="v">${esc(inv.id)}</span>
        <span class="k">Buyer #</span><span class="v">${esc(buyerNumber(buyer?.accountId || inv.accountId || '', buyer?.buyerNumber))}</span>
        ${inv.poNumber ? `<span class="k">PO #</span><span class="v">${esc(inv.poNumber)}</span>` : ''}
        <span class="k">Terms</span><span class="v">${esc(terms)}</span>
        <span class="k">Amount</span><span class="v strong">${money(totals.total)}</span>
      </div>
    </div>
  </div>

  <div class="inv-parties">
    ${partyBlock('Ship to', shipCompany, shipAddr, {
      email: (inv.shipEmail || buyer?.email || '').trim(),
      phone: (inv.shipPhone || buyer?.phone || '').trim(),
      attn: inv.shipAttn,
    })}
    ${partyBlock('Bill to', billCompany, billAddr, {
      email: (inv.billEmail || buyer?.email || '').trim(),
      phone: (inv.billPhone || buyer?.phone || '').trim(),
      attn: inv.billAttn,
      buyerNo: buyerNumber(buyer?.accountId || inv.accountId || '', buyer?.buyerNumber),
    })}
  </div>

  <table class="inv-items">
    <thead>
      <tr>
        <th style="width:28px">#</th>
        <th>Description</th>
        <th>Box</th>
        <th>SIM</th>
        <th>Grade</th>
        <th class="num">Qty</th>
        <th class="num">Unit</th>
        <th class="num">Amount (${esc(currMark)})</th>
      </tr>
    </thead>
    <tbody>${bodyRows || `<tr><td colspan="8" class="c">No line items</td></tr>`}</tbody>
  </table>
  ${profile.attachNote ? `<p class="inv-attach">${esc(profile.attachNote)}</p>` : ''}

  <div class="inv-sums-wrap">
    <table class="inv-sums">
      <tr>
        <td class="lab">Goods (${totals.qty.toLocaleString('en-US')} pcs)</td>
        <td class="amt">${money(totals.goods)}</td>
      </tr>
      ${
        feeOn
          ? `<tr>
        <td class="lab">Auction fee ${totals.feePct}%</td>
        <td class="amt">${money(totals.fee)}</td>
      </tr>`
          : ''
      }
      <tr class="grand">
        <td class="lab">Invoice total</td>
        <td class="amt">${money(totals.total)}</td>
      </tr>
    </table>
  </div>
  ${
    feeOn
      ? `<p class="inv-tiny">${esc(fillInvoiceTemplate(profile.feeCalcNote, tplVars))}</p>`
      : ''
  }

  <div class="inv-pay-row">
    <div class="inv-pay">
      <div class="inv-pay-lab">Bank details</div>
      <p class="inv-pay-lead">${esc(profile.paymentLead)}</p>
      <div class="inv-pay-grid">
        <span class="lab">Method</span><span class="val">${esc(profile.paymentMethod)}</span>
        <span class="lab">SWIFT</span><span class="val">${esc(profile.swift)}</span>
        <span class="lab">Bank</span><span class="val">${esc(profile.bankName)}</span>
        <span class="lab">Branch</span><span class="val">${esc(profile.branchName)}</span>
        <span class="inv-pay-branch">${esc(profile.branchAddress)}</span>
        <span class="lab">Account</span><span class="val">${esc(profile.accountNumber)}</span>
        <span class="lab">Beneficiary</span><span class="val">${esc(profile.beneficiary)}</span>
      </div>
      <p class="inv-pay-note">${esc(profile.bankFeesNote)}</p>
    </div>
    <div class="inv-terms">
      <div class="inv-terms-lab">Payment terms</div>
      <p class="inv-terms-body">${esc(fillInvoiceTemplate(profile.paymentAdvanceNote, tplVars))}</p>
      ${
        due
          ? `<div class="inv-terms-due"><span class="k">Due date</span><span class="v">${due}</span></div>`
          : ''
      }
    </div>
  </div>

  <div class="inv-remarks">
    ${
      feeOn
        ? `<p>${esc(fillInvoiceTemplate(profile.feeRemark, tplVars))}</p>`
        : ''
    }
    <p>${esc(profile.paymentNotice)}</p>
    ${inv.remarks ? `<p><strong>Remark:</strong> ${esc(inv.remarks)}</p>` : ''}
  </div>

  ${
    showStamps
      ? `<div class="inv-stamps noprint">
    <div class="inv-stamp"><strong>Admin issue</strong>${admin ? esc(admin) : '—'}</div>
    <div class="inv-stamp"><strong>Super admin issue</strong>${superBy ? esc(superBy) : '—'}</div>
  </div>`
      : ''
  }
  <div class="inv-foot">Page 1 of 1</div>
</div></body></html>`
}

export function invoicePreviewParts(html: string) {
  const style = html.match(/<style>([\s\S]*?)<\/style>/i)?.[1] || ''
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html
  return { style, body }
}

export function openInvoiceDocument(
  inv: Invoice,
  lots: Lot[] | Lot | undefined,
  buyer: Account | undefined,
  settings: SiteSettings,
  print = false,
) {
  const list = Array.isArray(lots) ? lots : lots ? [lots] : []
  const win = window.open('', '_blank', 'noopener,noreferrer,width=920,height=1100')
  if (!win) return
  win.document.write(invoiceDocHtml(inv, list, buyer, settings))
  win.document.close()
  win.focus()
  if (print) {
    setTimeout(() => {
      try {
        win.print()
      } catch {
        /* ignore */
      }
    }, 250)
  }
}

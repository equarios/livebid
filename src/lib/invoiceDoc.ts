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

function metaRow(label: string, value: string) {
  return `<tr>
    <td class="k">${esc(label)}</td>
    <td class="colon">:</td>
    <td class="v">${value}</td>
  </tr>`
}

function payRow(label: string, value: string) {
  return `<div class="pay-row"><span class="lab">${esc(label)}</span><span class="sep">:</span><span class="val">${esc(value)}</span></div>`
}

/** Commercial invoice HTML — Equarios letterhead, wholesale layout (Date / bank / lines / fee / ship·bill). */
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
        <td class="num">${money(goods)}</td>
      </tr>`
    })
    .join('')

  const partyBlock = (label: string, name: string, addr: string) =>
    `<div class="party">
      <div class="party-lab">${esc(label)} :</div>
      <div class="party-body">
        <div class="party-name">${esc(name)}</div>
        ${addr ? `<div class="party-addr">${nl(addr)}</div>` : '<div class="party-addr muted">Address on account</div>'}
      </div>
    </div>`

  return `<!doctype html><html><head><meta charset="utf-8"><title>invoice_${esc(inv.id)}-equarios</title>
<style>
  @page { size: A4; margin: 12mm 11mm 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #111;
    font: 11px/1.35 Arial, Helvetica, 'Noto Sans CJK', 'Noto Sans', sans-serif;
    background: #fff;
    -webkit-font-smoothing: antialiased;
  }
  .sheet { width: 100%; max-width: 190mm; margin: 0 auto; }
  .title {
    font-size: 26px; font-weight: 700; letter-spacing: 0.04em;
    margin: 0 0 12px; text-align: left;
  }
  .head { display: table; width: 100%; margin-bottom: 4px; }
  .head-l, .head-r { display: table-cell; vertical-align: top; }
  .head-r { width: 48%; padding-left: 12px; }
  .logo { height: 42px; max-width: 200px; object-fit: contain; margin-bottom: 8px; display: block; }
  .issuer { font-weight: 700; font-size: 13px; margin-bottom: 3px; }
  .addr { color: #222; white-space: pre-line; }
  .tel { margin-top: 2px; }
  .meta { width: 100%; border-collapse: collapse; }
  .meta .k { white-space: nowrap; padding: 1px 0; width: 88px; vertical-align: top; }
  .meta .colon { width: 12px; padding: 1px 6px 1px 0; vertical-align: top; }
  .meta .v { font-weight: 700; padding: 1px 0; vertical-align: top; }
  .pay {
    margin: 12px 0 10px;
    padding: 8px 10px;
    border: 1px solid #888;
    background: #f5f5f5;
  }
  .pay-lead { margin: 0 0 6px; }
  .pay-row { margin: 1px 0; display: table; width: 100%; }
  .pay-row .lab { display: table-cell; width: 210px; white-space: nowrap; vertical-align: top; }
  .pay-row .sep { display: table-cell; width: 12px; vertical-align: top; }
  .pay-row .val { display: table-cell; vertical-align: top; font-weight: 600; }
  .pay-branch { margin: 0 0 1px 0; padding-left: 0; }
  .pay-note { font-size: 10px; margin: 6px 0 0; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 4px; }
  table.items th, table.items td {
    border: 1px solid #333;
    padding: 3px 5px;
    font-size: 10px;
    vertical-align: middle;
  }
  table.items th {
    background: #e8e8e8;
    font-weight: 700;
    text-align: center;
  }
  table.items td.c, table.items th.c { text-align: center; }
  table.items td.num, table.items th.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  table.items td.desc { text-align: left; }
  table.items td.box { white-space: nowrap; }
  .attach { margin: 6px 0 4px; font-size: 10.5px; }
  .sums { width: 100%; border-collapse: collapse; margin-top: 6px; }
  .sums td { padding: 2px 4px; font-size: 12px; }
  .sums .lab { text-align: right; width: 62%; white-space: nowrap; }
  .sums .qty, .sums .amt {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .sums .qty { width: 12%; }
  .sums .amt { width: 26%; font-weight: 600; }
  .sums .grand td {
    font-size: 13px; font-weight: 800;
    border-top: 1px solid #111; padding-top: 4px;
  }
  .tiny { font-size: 10px; color: #222; margin: 6px 0 0; }
  .parties {
    display: table; width: 100%; margin-top: 14px;
    border-top: 1px solid #ccc; padding-top: 10px;
  }
  .party { display: table-cell; width: 50%; vertical-align: top; padding-right: 14px; }
  .party-lab { font-weight: 700; margin-bottom: 2px; }
  .party-name { font-weight: 700; text-transform: lowercase; }
  .party-addr { margin-top: 2px; }
  .party-addr.muted { color: #888; }
  .remarks { margin-top: 12px; font-size: 10.5px; }
  .remarks p { margin: 3px 0; }
  .stamps { display: table; width: 100%; margin-top: 16px; }
  .stamp {
    display: table-cell; width: 50%;
    border: 1px dashed #999; padding: 8px 10px; font-size: 10px;
  }
  .stamp + .stamp { border-left: 0; }
  .foot { margin-top: 18px; text-align: center; font-size: 10px; color: #666; }
  @media print {
    .noprint { display: none !important; }
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
</style></head><body><div class="sheet">
  <div class="title">Invoice</div>
  <div class="head">
    <div class="head-l">
      ${logo ? `<img class="logo" src="${esc(logo)}" alt="${esc(profile.legalName)}">` : ''}
      <div class="issuer">${esc(profile.legalName)}</div>
      <div class="addr">${nl(profile.address)}</div>
      ${profile.tel ? `<div class="tel">Tel : ${esc(profile.tel)}</div>` : ''}
    </div>
    <div class="head-r">
      <table class="meta">
        ${metaRow('Date', slashDate(issued))}
        ${metaRow('Invoice #', esc(inv.id))}
        ${metaRow('Buyer #', esc(buyerNumber(buyer?.accountId || inv.accountId || '', buyer?.buyerNumber)))}
        ${metaRow('PO #', esc(inv.poNumber || ''))}
        ${metaRow('Amount', money(totals.total))}
        ${metaRow('Terms', esc(terms))}
      </table>
    </div>
  </div>

  <div class="pay">
    <p class="pay-lead">${esc(profile.paymentLead)}</p>
    ${payRow('Method of Payment', profile.paymentMethod)}
    ${payRow('SWIFT Code', profile.swift)}
    ${payRow('Bank Name', profile.bankName)}
    ${payRow('Branch Name', profile.branchName)}
    <div class="pay-branch">(Address: ${esc(profile.branchAddress)})</div>
    ${payRow("Beneficiary's Account Number", profile.accountNumber)}
    ${payRow("Beneficiary's Name", profile.beneficiary)}
    <p class="pay-note">${esc(profile.bankFeesNote)}</p>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="width:28px"></th>
        <th>Description of Item</th>
        <th>Box-No</th>
        <th>SIM</th>
        <th>GRADE</th>
        <th class="num">Q'ty (unit)</th>
        <th class="num">per unit price</th>
        <th class="num">Price (${esc(currency === 'USD' ? '$' : currency)})</th>
      </tr>
    </thead>
    <tbody>${bodyRows || `<tr><td colspan="8" class="c">No line items</td></tr>`}</tbody>
  </table>
  <p class="attach">${esc(profile.attachNote)}</p>

  <table class="sums">
    <tr>
      <td class="lab">Total :</td>
      <td class="qty">${totals.qty.toLocaleString('en-US')}</td>
      <td class="amt">${money(totals.goods)}</td>
    </tr>
    ${
      feeOn
        ? `<tr>
      <td class="lab">Auction Fee：</td>
      <td class="qty">${totals.feePct}%</td>
      <td class="amt">${money(totals.fee)}</td>
    </tr>`
        : ''
    }
    <tr class="grand">
      <td class="lab">Invoice Total：</td>
      <td class="qty">${totals.qty.toLocaleString('en-US')}</td>
      <td class="amt">${money(totals.total)}</td>
    </tr>
  </table>
  <p class="tiny">${
    feeOn ? `${esc(fillInvoiceTemplate(profile.feeCalcNote, tplVars))} ` : ''
  }${esc(profile.bankFeesNote)}</p>

  <div class="parties">
    ${partyBlock('Ship to', shipCompany, shipAddr)}
    ${partyBlock('Bill to', billCompany, billAddr)}
  </div>

  <div class="remarks">
    <p>${esc(fillInvoiceTemplate(profile.paymentAdvanceNote, tplVars))}</p>
    ${
      feeOn
        ? `<p>${esc(fillInvoiceTemplate(profile.feeRemark, tplVars))}</p>
    <p>(REMARK) ${esc(fillInvoiceTemplate(profile.feeCalcNote, tplVars).replace(/^\*\s*/, ''))}</p>`
        : ''
    }
    <p>${esc(profile.paymentNotice)}</p>
    ${inv.remarks ? `<p>(REMARK) ${esc(inv.remarks)}</p>` : ''}
    ${due ? `<p class="tiny">Due date: ${due}</p>` : ''}
  </div>

  <div class="stamps noprint">
    <div class="stamp">Admin issue${admin ? `<br>${esc(admin)}` : '<br>—'}</div>
    <div class="stamp">Super admin issue${superBy ? `<br>${esc(superBy)}` : '<br>—'}</div>
  </div>
  <div class="foot">— 1 of 1 —</div>
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
    // Let layout settle before the print dialog (logo + tables).
    setTimeout(() => {
      try {
        win.print()
      } catch {
        /* ignore */
      }
    }, 250)
  }
}

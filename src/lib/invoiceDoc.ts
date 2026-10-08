import {
  boxNoForLot,
  buyerNumber,
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
  return `<tr><td class="k">${esc(label)}</td><td class="colon">:</td><td class="v">${value}</td></tr>`
}

export function invoiceDocHtml(
  inv: Invoice,
  lots: Lot[],
  buyer: Account | undefined,
  settings: SiteSettings,
) {
  const profile = settings.invoice
  const lotById = new Map(lots.map((l) => [l.id, l]))
  const lines = invoiceLines(inv)
  const totals = invoiceTotals(inv, settings)
  const issued = inv.issuedAt || inv.createdAt
  const company = buyer?.company || inv.accountId || 'Client'
  const ship = buyer?.address?.trim() || ''
  const logo = settings.brandLogo
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${settings.brandLogo}`
    : ''
  const admin = inv.issueAdmin?.decision === 'accepted' ? inv.issueAdmin.by : ''
  const superBy = inv.issueSuper?.decision === 'accepted' ? inv.issueSuper.by : ''
  const payDays = invoicePayDays(settings)
  const due = slashDate(invoiceDueAt(inv, settings))

  const bodyRows = lines
    .map((line, i) => {
      const lot = lotById.get(line.lotId)
      const goods = line.unitPrice * line.qty
      return `<tr>
        <td class="c">${i + 1}</td>
        <td>${esc(itemDescription(lot, line.lotId))}</td>
        <td>${esc(boxNoForLot(line.lotId, line.boxNo))}</td>
        <td>${lot?.simLocked ? 'Locked' : 'Unlocked'}</td>
        <td class="c">${esc(lot?.grade || '—')}</td>
        <td class="num">${line.qty.toLocaleString()}</td>
        <td class="num">${moneyUsd(line.unitPrice)}</td>
        <td class="num">${moneyUsd(goods)}</td>
      </tr>`
    })
    .join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(inv.id)}</title>
<style>
  @page { size: A4; margin: 12mm 12mm 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #111;
    font: 11px/1.35 Arial, Helvetica, 'Noto Sans', sans-serif;
    background: #fff;
  }
  .sheet { width: 100%; max-width: 190mm; margin: 0 auto; }
  .title { font-size: 22px; font-weight: 700; letter-spacing: 0.02em; margin: 0 0 10px; }
  .head { display: table; width: 100%; }
  .head-l, .head-r { display: table-cell; vertical-align: top; }
  .head-r { width: 46%; }
  .issuer { font-weight: 700; font-size: 13px; margin-bottom: 4px; }
  .addr { color: #222; }
  .logo { height: 36px; margin-bottom: 8px; display: block; }
  .meta { width: 100%; border-collapse: collapse; }
  .meta .k { white-space: nowrap; padding: 1px 0; width: 92px; }
  .meta .colon { width: 10px; padding: 1px 4px 1px 0; }
  .meta .v { font-weight: 700; padding: 1px 0; }
  .pay {
    margin: 12px 0 10px;
    padding: 8px 10px;
    border: 1px solid #bbb;
    background: #f7f7f7;
  }
  .pay p { margin: 0 0 6px; }
  .pay .row { margin: 1px 0; }
  .pay .lab { display: inline-block; min-width: 210px; }
  .note { font-size: 10px; margin: 4px 0 0; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.items th, table.items td {
    border: 1px solid #444;
    padding: 4px 5px;
    font-size: 10px;
    vertical-align: middle;
  }
  table.items th { background: #ececec; font-weight: 700; text-align: center; }
  table.items td.c, table.items th.c { text-align: center; }
  table.items td.num, table.items th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .parties { display: table; width: 100%; margin-top: 14px; }
  .party { display: table-cell; width: 50%; vertical-align: top; padding-right: 16px; }
  .party strong { display: inline-block; min-width: 64px; }
  .remarks { margin-top: 12px; font-size: 10.5px; }
  .remarks p { margin: 3px 0; }
  .sums { width: 100%; border-collapse: collapse; margin-top: 10px; }
  .sums td { padding: 3px 6px; font-size: 12px; }
  .sums .lab { text-align: right; width: 70%; }
  .sums .qty, .sums .amt { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .sums .grand td { font-size: 13px; font-weight: 800; border-top: 1px solid #111; }
  .tiny { font-size: 10px; color: #333; margin-top: 8px; }
  .foot { margin-top: 18px; text-align: center; font-size: 10px; color: #666; }
  .stamps { display: table; width: 100%; margin-top: 16px; }
  .stamp { display: table-cell; width: 50%; border: 1px dashed #999; padding: 8px 10px; font-size: 10px; }
  .stamp + .stamp { border-left: 0; }
  @media print { .noprint { display: none; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style></head><body><div class="sheet">
  <div class="title">Invoice</div>
  <div class="head">
    <div class="head-l">
      ${logo ? `<img class="logo" src="${esc(logo)}" alt="${esc(profile.legalName)}">` : ''}
      <div class="issuer">${esc(profile.legalName)}</div>
      <div class="addr">${nl(profile.address)}</div>
      ${profile.tel ? `<div>Tel : ${esc(profile.tel)}</div>` : ''}
    </div>
    <div class="head-r">
      <table class="meta">
        ${metaRow('Date', slashDate(issued))}
        ${metaRow('Invoice #', esc(inv.id))}
        ${metaRow('Buyer #', esc(buyerNumber(buyer?.accountId || inv.accountId || '')))}
        ${metaRow('PO #', esc(inv.poNumber || ''))}
        ${metaRow('Amount', moneyUsd(totals.total))}
        ${metaRow('Terms', esc(profile.terms))}
      </table>
    </div>
  </div>
  <div class="pay">
    <p>The payment shall be made by cash remittance to our specified account is as follows</p>
    <div class="row"><span class="lab">Method of Payment</span>: Bank Transfer</div>
    <div class="row"><span class="lab">SWIFT Code</span>: ${esc(profile.swift)}</div>
    <div class="row"><span class="lab">Bank Name</span>: ${esc(profile.bankName)}</div>
    <div class="row"><span class="lab">Branch Name</span>: ${esc(profile.branchName)}</div>
    <div class="row">(${esc(profile.branchAddress)})</div>
    <div class="row"><span class="lab">Beneficiary's Account Number</span>: ${esc(profile.accountNumber)}</div>
    <div class="row"><span class="lab">Beneficiary's Name</span>: ${esc(profile.beneficiary)}</div>
    <p class="note">*Payer shall be liable for relevant bank fees.</p>
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
        <th class="num">Price ($)</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="parties">
    <div class="party"><strong>Ship to :</strong> ${esc(company)}<br>${ship ? nl(ship) : '<span style="color:#888">Address on account</span>'}</div>
    <div class="party"><strong>Bill to :</strong> ${esc(company)}<br>${ship ? nl(ship) : ''}</div>
  </div>
  <div class="remarks">
    <p>(PAYMENT IN ADVANCE) The deadline is ${payDays} days from invoice date including date of issue. (${due})</p>
    ${
      totals.feePct > 0
        ? `<p>(REMARK) All unit prices are exclusive of ${totals.feePct}% System Usage Fee</p>
    <p>(REMARK) Please note that the Auction fee is calculated per unit, not the total amount.</p>`
        : ''
    }
    <p>(NOTICE) Please ensure both your buyer number and invoice number are stated in the payment details.</p>
    ${inv.remarks ? `<p>(REMARK) ${esc(inv.remarks)}</p>` : ''}
  </div>
  <table class="sums">
    <tr>
      <td class="lab">Total :</td>
      <td class="qty">${totals.qty.toLocaleString()}</td>
      <td class="amt">${moneyUsd(totals.goods)}</td>
    </tr>
    ${
      totals.feePct > 0
        ? `<tr>
      <td class="lab">Auction Fee：</td>
      <td class="qty">${totals.feePct}%</td>
      <td class="amt">${moneyUsd(totals.fee)}</td>
    </tr>`
        : ''
    }
    <tr class="grand">
      <td class="lab">Invoice Total：</td>
      <td class="qty">${totals.qty.toLocaleString()}</td>
      <td class="amt">${moneyUsd(totals.total)}</td>
    </tr>
  </table>
  <p class="tiny">${totals.feePct > 0 ? '* Please note that the Auction fee is calculated per unit, not the total amount. ' : ''}* Payer shall be liable for relevant bank fees.</p>
  <p class="tiny">Details for Devices are as per the attached catalog / lot record.</p>
  <div class="stamps">
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
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1100')
  if (!win) return
  win.document.write(invoiceDocHtml(inv, list, buyer, settings))
  win.document.close()
  win.focus()
  if (print) win.print()
}

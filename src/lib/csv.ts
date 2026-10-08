export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(cell.trim())
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell.trim())
      cell = ''
      if (row.some((c) => c)) rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell.trim())
  if (row.some((c) => c)) rows.push(row)
  return rows
}

function headerKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export type CsvBidRow = {
  lotId: string
  qty: number
  amount: number
  line: number
  auctionType: string
  auctionName: string
}

export function parseBidCsv(text: string): { rows: CsvBidRow[]; error?: string } {
  const table = parseCsv(text)
  if (!table.length) return { rows: [], error: 'That file is empty.' }
  const head = table[0].map(headerKey)
  const lotIx = head.findIndex((h) => ['lotid', 'lot', 'id', 'auctionlot'].includes(h))
  const desiredIx = head.findIndex((h) =>
    ['desiredqty', 'desiredquantity', 'bidqty', 'orderqty'].includes(h),
  )
  const qtyIx =
    desiredIx >= 0
      ? desiredIx
      : head.findIndex((h) => ['qty', 'quantity', 'pcs'].includes(h))
  const priceIx = head.findIndex((h) =>
    ['price', 'amount', 'unitprice', 'pricepc', 'bid', 'yourprice', 'priceperpc'].includes(h),
  )
  const typeIx = head.findIndex((h) =>
    ['auctiontype', 'type', 'listid', 'list', 'auction'].includes(h),
  )
  const nameIx = head.findIndex((h) =>
    ['auctionname', 'auctionlabel', 'typename', 'listname', 'listlabel'].includes(h),
  )
  if (lotIx < 0 || qtyIx < 0 || priceIx < 0) {
    return { rows: [], error: 'Header must include lotId, desiredQty, and price.' }
  }
  if (typeIx < 0 && nameIx < 0) {
    return {
      rows: [],
      error:
        'Header must include auctionType or auctionName so you do not bid on the wrong list. Download a fresh bid CSV from this list.',
    }
  }
  const rows: CsvBidRow[] = []
  table.slice(1).forEach((cols, i) => {
    const lotId = (cols[lotIx] || '').trim()
    const qtyRaw = cols[qtyIx]
    const priceRaw = cols[priceIx]
    if (!lotId) return
    if (!qtyRaw && !priceRaw) return
    rows.push({
      lotId,
      qty: qtyRaw === '' || qtyRaw == null ? Number.NaN : Number(qtyRaw),
      amount: priceRaw === '' || priceRaw == null ? Number.NaN : Number(priceRaw),
      line: i + 2,
      auctionType: typeIx >= 0 ? (cols[typeIx] || '').trim() : '',
      auctionName: nameIx >= 0 ? (cols[nameIx] || '').trim() : '',
    })
  })
  return { rows }
}

export function csvTypeKey(value: string) {
  return headerKey(value)
}

export function csvAuctionMatches(lotSlug: string, lotName: string, csvType?: string, csvName?: string) {
  const slug = csvTypeKey(lotSlug)
  const name = csvTypeKey(lotName)
  const type = csvTypeKey(csvType || '')
  const label = csvTypeKey(csvName || '')
  if (!type && !label) return false
  if (type && type !== slug && type !== name) return false
  if (label && label !== slug && label !== name) return false
  return true
}

export function csvCell(value: string | number) {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function downloadCsv(filename: string, header: string[], lines: Array<Array<string | number>>) {
  const body = [header.map(csvCell).join(','), ...lines.map((row) => row.map(csvCell).join(','))].join('\n')
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function stockLeft(qty: number, inCart: number) {
  return Math.max(0, qty - inCart)
}

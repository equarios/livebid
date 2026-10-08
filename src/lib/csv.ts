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

export type CsvListingRow = {
  lotId: string
  channel: 'auction' | 'marketplace'
  auctionType: string
  auctionName: string
  manufacturer: string
  model: string
  modelNumber: string
  capacity: string
  color: string
  origin: string
  grade: string
  battery: number
  qty: number
  moq: number | undefined
  price: number
  description: string
  line: number
}

export function parseListingCsv(text: string): { rows: CsvListingRow[]; error?: string } {
  const table = parseCsv(text)
  if (!table.length) return { rows: [], error: 'That file is empty.' }
  const head = table[0].map(headerKey)
  const ix = (names: string[]) => head.findIndex((h) => names.includes(h))
  const lotIx = ix(['lotid', 'lot', 'id', 'sku'])
  const channelIx = ix(['channel', 'listkind'])
  const typeIx = ix(['auctiontype', 'type', 'listid', 'list', 'auction'])
  const nameIx = ix(['auctionname', 'auctionlabel', 'typename', 'listname', 'listlabel'])
  const makerIx = ix(['manufacturer', 'maker', 'brand'])
  const modelIx = ix(['model', 'item', 'product'])
  const modelNoIx = ix(['modelnumber', 'modelno', 'mpn'])
  const capIx = ix(['capacity', 'memory', 'storage'])
  const colorIx = ix(['color', 'colour'])
  const originIx = ix(['origin', 'region'])
  const gradeIx = ix(['grade'])
  const battIx = ix(['battery', 'batterypct', 'soh'])
  const qtyIx = ix(['qty', 'quantity', 'pcs', 'totalpcs'])
  const moqIx = ix(['moq', 'minqty'])
  const priceIx = ix(['price', 'amount', 'unitprice', 'pricepc', 'startprice', 'buynow'])
  const notesIx = ix(['description', 'notes', 'condition'])
  if (modelIx < 0 || qtyIx < 0 || priceIx < 0) {
    return { rows: [], error: 'Header must include model, qty, and price.' }
  }
  if (typeIx < 0 && nameIx < 0 && channelIx < 0) {
    return {
      rows: [],
      error:
        'Header must include auctionType or auctionName (or channel) so each row lands on the right list. Download a fresh listing CSV.',
    }
  }
  const rows: CsvListingRow[] = []
  table.slice(1).forEach((cols, i) => {
    const model = (cols[modelIx] || '').trim()
    const qty = Number(cols[qtyIx])
    const price = Number(cols[priceIx])
    const battery = battIx >= 0 ? Number(cols[battIx]) : 90
    const moqRaw = moqIx >= 0 ? (cols[moqIx] || '').trim() : ''
    const moq = moqRaw === '' ? undefined : Number(moqRaw)
    if (!model && !qty && !price) return
    rows.push({
      lotId: lotIx >= 0 ? (cols[lotIx] || '').trim() : '',
      channel: channelIx >= 0 ? ((cols[channelIx] || '').trim().toLowerCase() as CsvListingRow['channel']) : 'auction',
      auctionType: typeIx >= 0 ? (cols[typeIx] || '').trim() : '',
      auctionName: nameIx >= 0 ? (cols[nameIx] || '').trim() : '',
      manufacturer: makerIx >= 0 ? (cols[makerIx] || '').trim() : 'Apple',
      model,
      modelNumber: modelNoIx >= 0 ? (cols[modelNoIx] || '').trim() : '',
      capacity: capIx >= 0 ? (cols[capIx] || '').trim() : '',
      color: colorIx >= 0 ? (cols[colorIx] || '').trim() : '',
      origin: originIx >= 0 ? (cols[originIx] || '').trim() : 'INT',
      grade: gradeIx >= 0 ? (cols[gradeIx] || '').trim() : '',
      battery: Number.isFinite(battery) ? battery : 90,
      qty,
      moq: moq != null && Number.isInteger(moq) ? moq : undefined,
      price,
      description: notesIx >= 0 ? (cols[notesIx] || '').trim() : '',
      line: i + 2,
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

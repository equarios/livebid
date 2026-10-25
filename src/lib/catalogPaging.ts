export const CATALOG_PAGE_SIZES = [24, 36, 48] as const
export type CatalogPageSize = (typeof CATALOG_PAGE_SIZES)[number]
export const CATALOG_PAGE_SIZE_IDS = ['24', '36', '48'] as const
export const CATALOG_PAGE_SIZE_DEFAULT: CatalogPageSize = 36

export function readCatalogPageSize(storageKey: string): CatalogPageSize {
  try {
    const n = Number(localStorage.getItem(storageKey))
    if ((CATALOG_PAGE_SIZES as readonly number[]).includes(n)) return n as CatalogPageSize
  } catch {
    /* ignore */
  }
  return CATALOG_PAGE_SIZE_DEFAULT
}

export function writeCatalogPageSize(storageKey: string, size: CatalogPageSize) {
  try {
    localStorage.setItem(storageKey, String(size))
  } catch {
    /* ignore */
  }
}

export function pageWindow(current: number, total: number, radius = 2) {
  if (total <= 1) return [1]
  const start = Math.max(1, current - radius)
  const end = Math.min(total, current + radius)
  const pages: number[] = []
  if (start > 1) pages.push(1)
  if (start > 2) pages.push(-1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total - 1) pages.push(-2)
  if (end < total) pages.push(total)
  return pages
}

export function slicePage<T>(items: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(Math.max(1, page), pageCount)
  const start = (safePage - 1) * pageSize
  return {
    pageCount,
    safePage,
    items: items.slice(start, start + pageSize),
  }
}

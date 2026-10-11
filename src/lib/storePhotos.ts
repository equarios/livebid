import type { StoreProductDto } from './api'

function src(id: string, w: number) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`
}

/** Stable phone fallback (verified 200). */
const FALLBACK = 'photo-1511707171634-5f897ff02aa9'

const KEYWORDS: Array<{ match: RegExp; ids: string[] }> = [
  { match: /iphone\s*15\s*pro/i, ids: ['photo-1695048133142-1a20484d2569', 'photo-1592899677977-9c10ca588bbd'] },
  { match: /iphone\s*15/i, ids: ['photo-1695048133142-1a20484d2569', 'photo-1556656793-08538906a9f8'] },
  { match: /iphone\s*14/i, ids: ['photo-1678685888221-cda773a3dcdb', 'photo-1592899677977-9c10ca588bbd'] },
  { match: /iphone\s*13/i, ids: ['photo-1601784551446-20c9e07cdbdb', 'photo-1580910051074-3eb694886505'] },
  { match: /iphone\s*12/i, ids: ['photo-1605236453806-6ff0755d8b7a', 'photo-1511707171634-5f897ff02aa9'] },
  { match: /iphone/i, ids: ['photo-1695048133142-1a20484d2569', 'photo-1556656793-08538906a9f8'] },
  { match: /galaxy\s*s24|s24\s*ultra/i, ids: ['photo-1610945415295-d9bbf067e59c', 'photo-1598327105666-5b89351aff97'] },
  { match: /galaxy\s*s22|s22/i, ids: ['photo-1610945415295-d9bbf067e59c', 'photo-1598327105666-5b89351aff97'] },
  { match: /galaxy\s*a54|a54/i, ids: ['photo-1610945415295-d9bbf067e59c', 'photo-1592899677977-9c10ca588bbd'] },
  { match: /galaxy\s*tab|tab\s*s9/i, ids: ['photo-1561154464-82e9adf32764', 'photo-1544244015-0df4b3ffc6b0'] },
  { match: /galaxy|samsung/i, ids: ['photo-1610945415295-d9bbf067e59c', 'photo-1598327105666-5b89351aff97'] },
  { match: /pixel\s*9/i, ids: ['photo-1598327105666-5b89351aff97', 'photo-1556656793-08538906a9f8'] },
  { match: /pixel/i, ids: ['photo-1598327105666-5b89351aff97', 'photo-1511707171634-5f897ff02aa9'] },
  { match: /xperia/i, ids: ['photo-1511707171634-5f897ff02aa9', 'photo-1598327105666-5b89351aff97'] },
  { match: /macbook/i, ids: ['photo-1517336714731-489689fd1ca8', 'photo-1496181133206-80ce9b88a853'] },
  { match: /ipad\s*air|ipad|tablet/i, ids: ['photo-1544244015-0df4b3ffc6b0', 'photo-1585790050230-5dd28404ccb9'] },
  { match: /watch/i, ids: ['photo-1434493789847-2f02dc6ca35d', 'photo-1523275335684-37898b6baf30'] },
]

/** Broken-image placeholder — never hits Unsplash again. */
export function storeProductFallback(product: Pick<StoreProductDto, 'title'>) {
  const label = encodeURIComponent(product.title.slice(0, 40))
  return `https://placehold.co/800x600/133a8a/ffffff?text=${label}`
}

function stockGallery(title: string, w: number): string[] {
  for (const row of KEYWORDS) {
    if (row.match.test(title)) return row.ids.map((id) => src(id, w))
  }
  return [src(FALLBACK, w)]
}

/** All gallery URLs (uploaded / custom), or keyword stock set when empty. */
export function storeProductImages(
  product: Pick<StoreProductDto, 'title' | 'imageUrl' | 'images'>,
  w = 640,
): string[] {
  const custom: string[] = []
  if (Array.isArray(product.images)) {
    for (const u of product.images) {
      if (typeof u === 'string' && u.trim() && !custom.includes(u.trim())) custom.push(u.trim())
    }
  }
  if (!custom.length && product.imageUrl?.trim()) custom.push(product.imageUrl.trim())
  if (custom.length) return custom
  return stockGallery(product.title, w)
}

/** Cover image: first gallery URL, else Unsplash by title. */
export function storeProductImage(
  product: Pick<StoreProductDto, 'title' | 'imageUrl' | 'images'>,
  w = 640,
  forceStock = false,
) {
  if (forceStock) return src(FALLBACK, w)
  return storeProductImages(product, w)[0] || src(FALLBACK, w)
}

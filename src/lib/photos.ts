import type { Lot } from '../types'

function src(id: string, w: number) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`
}

const SETS: Record<string, string[]> = {
  'iphone 15 pro': [
    'photo-1695048133142-1a20484d2569',
    'photo-1695048141754-8d1ca5d0d7c7',
    'photo-1592899677977-9c10ca588bbd',
  ],
  'iphone 15': [
    'photo-1695048133142-1a20484d2569',
    'photo-1580910051074-3eb694886505',
    'photo-1556656793-08538906a9f8',
  ],
  'iphone 14': [
    'photo-1678685888221-cda773a3dcdb',
    'photo-1592899677977-9c10ca588bbd',
    'photo-1511707171634-5f897ff02aa9',
  ],
  'iphone 13': [
    'photo-1632661674596-79ae5b9262e8',
    'photo-1601784551446-20c9e07cdbdb',
    'photo-1580910051074-3eb694886505',
  ],
  'iphone 12': [
    'photo-1605236453806-6ff0755d8b7a',
    'photo-1511707171634-5f897ff02aa9',
    'photo-1574944985070-8f3ebc6b79d2',
  ],
  'galaxy s24 ultra': [
    'photo-1610945415295-d9bbf067e59c',
    'photo-1598327105666-5b89351aff97',
    'photo-1511707171634-5f897ff02aa9',
  ],
  'galaxy a54': [
    'photo-1610945415295-d9bbf067e59c',
    'photo-1592899677977-9c10ca588bbd',
    'photo-1601784551446-20c9e07cdbdb',
  ],
  'ipad air 5': [
    'photo-1544244015-0df4b3ffc6b0',
    'photo-1561154464-82e9adf32764',
    'photo-1585790050230-5dd28404ccb9',
  ],
  'macbook air m2': [
    'photo-1517336714731-489689fd1ca8',
    'photo-1496181133206-80ce9b88a853',
    'photo-1517694712202-14dd9538aa97',
  ],
  'xperia 1 v': [
    'photo-1511707171634-5f897ff02aa9',
    'photo-1598327105666-5b89351aff97',
    'photo-1601784551446-20c9e07cdbdb',
  ],
  'galaxy tab s9': [
    'photo-1561154464-82e9adf32764',
    'photo-1544244015-0df4b3ffc6b0',
    'photo-1585790050230-5dd28404ccb9',
  ],
  'watch series 9': [
    'photo-1434493789847-2f02dc6ca35d',
    'photo-1523275335684-37898b6baf30',
    'photo-1579586337278-3befd40fd17a',
  ],
  'pixel 8 pro': [
    'photo-1598327105666-5b89351aff97',
    'photo-1511707171634-5f897ff02aa9',
    'photo-1601784551446-20c9e07cdbdb',
  ],
  'pixel 9': [
    'photo-1598327105666-5b89351aff97',
    'photo-1592899677977-9c10ca588bbd',
    'photo-1556656793-08538906a9f8',
  ],
}

const FALLBACK = [
  'photo-1511707171634-5f897ff02aa9',
  'photo-1592899677977-9c10ca588bbd',
  'photo-1601784551446-20c9e07cdbdb',
]

export function lotPhotos(lot: Lot, width = 1200): string[] {
  const key = lot.model.toLowerCase()
  const ids = SETS[key] || FALLBACK
  return ids.map((id) => src(id, width))
}

export function lotThumb(lot: Lot): string {
  return lotPhotos(lot, 160)[0]
}

export function photoFallback(lot: Lot): string {
  const label = encodeURIComponent(`${lot.manufacturer} ${lot.model}`)
  return `https://placehold.co/800x600/133a8a/ffffff?text=${label}`
}

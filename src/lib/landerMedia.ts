/** Shared lander photos — store, wholesale hub, and desk strips stay one family. */

function unsplash(id: string, w: number) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=72`
}

/** Device-forward set (phones / tablets). Use `hub` for full landers, `desk` for strips. */
export const LANDER_PHOTOS = {
  phoneStack: (w: 1600 | 2000 = 2000) => unsplash('photo-1511707171634-5f897ff02aa9', w),
  phoneFlat: (w: 1600 | 2000 = 2000) => unsplash('photo-1592899677977-9c10ca588bbd', w),
  tablet: (w: 1600 | 2000 = 2000) => unsplash('photo-1544244015-0df4b3ffc6b0', w),
  phoneHand: (w: 1600 | 2000 = 2000) => unsplash('photo-1556656793-08538906a9f8', w),
} as const

/** Fallback when a slide has no image URL. */
export const LANDER_FALLBACK_PHOTO = LANDER_PHOTOS.phoneStack(2000)

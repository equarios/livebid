/** Colour-name → CSS swatch, shared by cards, pickers and the cart. */
export type ColorSwatch = { background: string; light?: boolean }

export function colorSwatch(name: string): ColorSwatch {
  const n = name.toLowerCase()
  if (/(black|onyx|obsidian|phantom|midnight|charcoal|space)/.test(n)) {
    return { background: 'linear-gradient(145deg, #3a3a3c 0%, #0d0d0f 55%, #2c2c2e 100%)' }
  }
  if (/(graphite|gray|grey)/.test(n)) {
    return { background: 'linear-gradient(145deg, #b0b0b5 0%, #6e6e73 100%)' }
  }
  if (/(silver|marble)/.test(n)) {
    return {
      background: 'linear-gradient(145deg, #f5f5f7 0%, #c7c7cc 55%, #e8e8ed 100%)',
      light: true,
    }
  }
  if (/(white|snow|starlight|cream|milk)/.test(n)) {
    return { background: 'linear-gradient(145deg, #ffffff 0%, #ebebf0 100%)', light: true }
  }
  if (/(blue|sky)/.test(n)) {
    return { background: 'linear-gradient(145deg, #7eb6e8 0%, #2f5f9e 55%, #1e3a6e 100%)' }
  }
  if (/(navy|cobalt)/.test(n)) {
    return { background: 'linear-gradient(145deg, #4a6fa5 0%, #1a2f5a 100%)' }
  }
  if (/(pink|rose)/.test(n)) {
    return { background: 'linear-gradient(145deg, #f5c6d4 0%, #d4849a 55%, #b85a75 100%)' }
  }
  if (/(violet|purple)/.test(n)) {
    return { background: 'linear-gradient(145deg, #b8a4d9 0%, #6b4f9a 100%)' }
  }
  if (/(green|mint|meadow|lime|jade)/.test(n)) {
    return { background: 'linear-gradient(145deg, #8fd4b0 0%, #2f7a58 100%)' }
  }
  if (/(gold|yellow|amber)/.test(n)) {
    return { background: 'linear-gradient(145deg, #f0e0a8 0%, #c9a227 100%)', light: true }
  }
  if (/(orange|sunrise|hazel)/.test(n)) {
    return { background: 'linear-gradient(145deg, #ffb07c 0%, #e07030 100%)' }
  }
  if (/(red|coral)/.test(n)) {
    return { background: 'linear-gradient(145deg, #f08080 0%, #c0392b 100%)' }
  }
  return { background: 'linear-gradient(145deg, #c5cdd6 0%, #7a8794 100%)' }
}

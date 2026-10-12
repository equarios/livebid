import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tmp = join(root, 'scripts', '_verify-tmp.mts')

writeFileSync(
  tmp,
  `
import { APP_LOCALES, LOCALE_META } from '../src/i18n/locales.ts'
import { PACKS } from '../src/i18n/packs/index.ts'
import {
  allSeoPaths,
  prerenderSeoPaths,
  inferDeviceClass,
  inferCondition,
  lotMatchesFacet,
  parseCategoryParams,
  categoryPath,
} from '../src/lib/seoTaxonomy.ts'

const missing = APP_LOCALES.filter((l) => l !== 'en' && !(l in PACKS))
const rtl = APP_LOCALES.filter((l) => LOCALE_META[l].dir === 'rtl')
const lots = [
  { manufacturer: 'Apple', model: 'iPhone 15', description: '', grade: 'A', simLocked: false },
  { manufacturer: 'Apple', model: 'iPad Air', description: '', grade: 'A' },
  { manufacturer: 'Sony', model: 'PlayStation 5', description: '', grade: 'B' },
  { manufacturer: 'Samsung', model: 'Galaxy S24', description: 'scrap board', grade: 'C', simLocked: true },
  { manufacturer: 'Google', model: 'Pixel 8', description: 'refurbished unit', grade: 'A' },
]

const checks = []
function check(name, pass, detail = '') {
  checks.push({ name, pass: Boolean(pass), detail })
  console.log(\`\${pass ? 'PASS' : 'FAIL'}  \${name}\${detail ? ' — ' + detail : ''}\`)
}

check('locales 22', APP_LOCALES.length === 22, String(APP_LOCALES.length))
check('packs 21', Object.keys(PACKS).length === 21, String(Object.keys(PACKS).length))
check('no missing packs', missing.length === 0, missing.join(',') || 'none')
check('rtl ar,he,ur', rtl.join(',') === 'ar,he,ur', rtl.join(','))
check('sitemap size', allSeoPaths().length > 1000, String(allSeoPaths().length))
check('prerender size', prerenderSeoPaths().length > 50, String(prerenderSeoPaths().length))
check('parse phones/unlocked/apple', Boolean(parseCategoryParams(['phones','unlocked','apple'])?.brand === 'apple'))
check('parse bad slug', parseCategoryParams(['nope']) === null)
check('path builder', categoryPath({ deviceClass: 'phones', condition: 'unlocked', brand: 'apple' }) === '/wholesale/c/phones/unlocked/apple')
check('infer iPhone → phones', inferDeviceClass(lots[0]) === 'phones')
check('infer iPad → tablets', inferDeviceClass(lots[1]) === 'tablets')
check('infer PS5 → consoles', inferDeviceClass(lots[2]) === 'consoles')
check('infer scrap', inferCondition(lots[3]) === 'scrap')
check('infer refurbished', inferCondition(lots[4]) === 'refurbished')
check('unlocked phone match', lotMatchesFacet(lots[0], { deviceClass: 'phones', condition: 'unlocked' }))
check('locked scrap no unlock match', !lotMatchesFacet(lots[3], { deviceClass: 'phones', condition: 'unlocked' }))

const failed = checks.filter((c) => !c.pass)
console.log(failed.length ? \`\\n\${failed.length} failed\` : \`\\n\${checks.length}/\${checks.length} passed\`)
process.exit(failed.length ? 1 : 0)
`,
)

const r = spawnSync('npx', ['tsx', tmp], { cwd: root, encoding: 'utf8', shell: true })
process.stdout.write(r.stdout || '')
process.stderr.write(r.stderr || '')
try {
  unlinkSync(tmp)
} catch {
  /* ignore */
}
process.exit(r.status ?? 1)

/**
 * Writes public/robots.txt, public/sitemap.xml, and scripts/seo-prerender-routes.json
 * from the same taxonomy used by the React app.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const DEVICE_CLASSES = [
  'phones',
  'tablets',
  'pcs',
  'laptops',
  'chromebooks',
  'consoles',
  'other',
]
const CONDITIONS = ['new', 'used', 'refurbished', 'recycled', 'scrap', 'locked', 'unlocked']
const OS_FAMILIES = ['ios', 'android', 'other-os']
const SEO_BRANDS = [
  'apple',
  'samsung',
  'google',
  'xiaomi',
  'huawei',
  'oppo',
  'vivo',
  'oneplus',
  'sony',
  'microsoft',
  'nintendo',
  'asus',
  'lenovo',
  'dell',
  'hp',
  'acer',
]

function categoryPath({ deviceClass, condition, brand, os }) {
  const parts = ['/wholesale/c']
  if (deviceClass) parts.push(deviceClass)
  if (condition) parts.push(condition)
  if (brand) parts.push(brand)
  else if (os) parts.push(os)
  return parts.join('/')
}

function allSeoPaths() {
  const paths = new Set(['/wholesale/c', '/', '/wholesale', '/buyers', '/sellers', '/support', '/store'])
  for (const dc of DEVICE_CLASSES) {
    paths.add(categoryPath({ deviceClass: dc }))
    for (const cond of CONDITIONS) {
      paths.add(categoryPath({ deviceClass: dc, condition: cond }))
      for (const brand of SEO_BRANDS) {
        paths.add(categoryPath({ deviceClass: dc, condition: cond, brand }))
      }
      for (const os of OS_FAMILIES) {
        paths.add(categoryPath({ deviceClass: dc, condition: cond, os }))
      }
    }
    for (const brand of SEO_BRANDS) {
      paths.add(categoryPath({ deviceClass: dc, brand }))
    }
    for (const os of OS_FAMILIES) {
      paths.add(categoryPath({ deviceClass: dc, os }))
    }
  }
  return [...paths].sort()
}

function prerenderSeoPaths() {
  const paths = new Set(['/wholesale/c', '/buyers', '/sellers', '/support', '/wholesale'])
  for (const dc of DEVICE_CLASSES) {
    paths.add(categoryPath({ deviceClass: dc }))
    for (const cond of CONDITIONS) {
      paths.add(categoryPath({ deviceClass: dc, condition: cond }))
    }
    for (const brand of ['apple', 'samsung', 'google', 'sony', 'microsoft', 'nintendo']) {
      paths.add(categoryPath({ deviceClass: dc, brand }))
    }
  }
  return [...paths].sort()
}

const siteUrl = (process.env.SITE_URL || 'https://equarios.com').replace(/\/$/, '')
const paths = allSeoPaths()
const prerender = prerenderSeoPaths()
const today = new Date().toISOString().slice(0, 10)

const robots = `User-agent: *
Allow: /
Allow: /wholesale/c
Disallow: /admin
Disallow: /super
Disallow: /account
Disallow: /login
Disallow: /register

Sitemap: ${siteUrl}/sitemap.xml
`

const urlEntries = paths
  .map((path) => {
    const loc = `${siteUrl}${path}`
    const priority =
      path === '/' ? '1.0' : path === '/wholesale/c' || path === '/wholesale' ? '0.9' : path.startsWith('/wholesale/c/') ? '0.8' : '0.6'
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${priority}</priority>
  </url>`
  })
  .join('\n')

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`

const publicDir = join(root, 'public')
mkdirSync(publicDir, { recursive: true })
writeFileSync(join(publicDir, 'robots.txt'), robots)
writeFileSync(join(publicDir, 'sitemap.xml'), sitemap)
writeFileSync(
  join(root, 'scripts', 'seo-prerender-routes.json'),
  JSON.stringify(
    {
      siteUrl,
      generatedAt: new Date().toISOString(),
      prerender,
      sitemapCount: paths.length,
    },
    null,
    2,
  ),
)

console.log(`SEO: ${paths.length} sitemap URLs → public/sitemap.xml`)
console.log(`SEO: ${prerender.length} prerender routes → scripts/seo-prerender-routes.json`)
console.log(`SEO: robots.txt (Sitemap: ${siteUrl}/sitemap.xml)`)

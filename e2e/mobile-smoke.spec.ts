import { expect, test, type Page } from '@playwright/test'
import { dismissWarn } from './helpers/ui'

/** Public / store surfaces that must stay usable on phone + tablet. */
const ROUTES = [
  '/',
  '/store',
  '/login',
  '/register',
  '/support',
  '/wholesale',
  '/auctions',
  '/cart',
  '/buyers',
] as const

async function waitSettled(page: Page) {
  await page.waitForFunction(
    () => !/Loading (session|page)/i.test(document.body?.innerText || ''),
    undefined,
    { timeout: 20_000 },
  ).catch(() => undefined)
  await dismissWarn(page)
}

async function pageOverflowX(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    return {
      overflowX: doc.scrollWidth - doc.clientWidth,
      vw: window.innerWidth,
      vh: window.innerHeight,
      path: location.pathname,
    }
  })
}

async function assertNoPageOverflow(page: Page) {
  const m = await pageOverflowX(page)
  expect(m.overflowX, `horizontal page overflow on ${m.path} @ ${m.vw}x${m.vh}`).toBeLessThanOrEqual(2)
}

test.describe('Mobile / tablet smoke', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await page.addInitScript(() => {
      try {
        localStorage.clear()
        sessionStorage.clear()
        localStorage.setItem('livebid-locale', 'en')
      } catch {
        /* ignore */
      }
    })
  })

  for (const path of ROUTES) {
    test(`${path} fits viewport without page overflow`, async ({ page }) => {
      await page.goto(path)
      await waitSettled(page)
      await expect(page.locator('body')).toBeVisible()
      await assertNoPageOverflow(page)
      // Guest auctions / cart may bounce — landing surface must still fit.
      if (path === '/login' || path === '/cart' || path === '/auctions') {
        await expect(page).toHaveURL(/\/(login|auctions|store|cart|register|\/?)(\/|$|\?)/)
      }
      const heading = page.getByRole('heading').first()
      if (await heading.count()) {
        await expect(heading).toBeVisible()
      }
    })
  }

  test('phone/tablet menu toggle opens nav', async ({ page }, testInfo) => {
    const isNarrow =
      testInfo.project.name.startsWith('mobile') || testInfo.project.name.startsWith('tablet')
    test.skip(!isNarrow, 'menu toggle is for narrow viewports')

    await page.goto('/')
    await waitSettled(page)

    const menu = page.getByRole('button', { name: /^menu$/i })
    await expect(menu).toBeVisible()
    await menu.click()
    // Open wrap must un-hide inner <nav> (regression: wrap was flex while site-nav stayed display:none).
    const openNav = page.locator('.site-nav-wrap.is-open .site-nav, .pub-links.is-open .site-nav').first()
    await expect(openNav).toBeVisible()
    const display = await openNav.evaluate((el) => getComputedStyle(el).display)
    expect(display, 'open Menu must show inner site-nav').not.toBe('none')
    await expect(openNav.locator('a').first()).toBeVisible()
    await assertNoPageOverflow(page)
  })

  test('login form uses ≥16px inputs on narrow viewports', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile'), 'iOS zoom guard is phone-focused')

    await page.goto('/login')
    await waitSettled(page)
    if (!page.url().includes('/login')) {
      test.skip(true, 'login redirected (session or gate)')
    }

    const email = page.getByPlaceholder(/email address/i)
    await expect(email).toBeVisible()
    const fontSize = await email.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(fontSize, 'inputs should be ≥16px to avoid iOS focus zoom').toBeGreaterThanOrEqual(16)
  })

  test('phone landscape home has no page overflow', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile'), 'landscape check is phone-focused')

    // Rotate the project’s phone viewport (e.g. 390×664 → 664×390).
    const box = page.viewportSize()
    if (!box) test.skip(true, 'no viewport')
    await page.setViewportSize({ width: Math.max(box!.height, 640), height: Math.min(box!.width, 430) })

    await page.goto('/')
    await waitSettled(page)
    await assertNoPageOverflow(page)
    await expect(page.getByRole('heading').first()).toBeVisible()
  })
})

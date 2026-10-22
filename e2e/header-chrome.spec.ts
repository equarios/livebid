import { expect, test } from '@playwright/test'
import { loginSuper } from './helpers/auth'
import { dismissWarn } from './helpers/ui'

async function panelOnScreen(page: import('@playwright/test').Page, selector: string) {
  return page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect()
    return {
      left: r.left,
      right: r.right,
      width: r.width,
      height: r.height,
      inView: r.left >= -2 && r.right <= window.innerWidth + 2 && r.width > 8 && r.height > 8,
    }
  })
}

test.describe('Header chrome — Help / Notifications / Super', () => {
  test.beforeEach(async ({ page }) => {
    await loginSuper(page)
    await dismissWarn(page)
  })

  test('Help link opens Support with topic tabs', async ({ page }) => {
    await page.goto('/auctions')
    await dismissWarn(page)

    await page.getByRole('link', { name: /^help$/i }).click()
    await expect(page).toHaveURL(/\/support/)
    await expect(page.getByRole('navigation', { name: /^help$/i })).toBeVisible()
    await page.getByRole('link', { name: /^device spec$/i }).click()
    await expect(page).toHaveURL(/\/device-spec/)
  })

  test('Notifications panel opens on-screen', async ({ page }) => {
    await page.goto('/auctions')
    await dismissWarn(page)

    await page.getByRole('button', { name: /notifications/i }).click()
    const panel = page.locator('.notice-panel')
    await expect(panel).toBeVisible()
    const box = await panelOnScreen(page, '.notice-panel')
    expect(box.inView, `Notifications panel off-screen: left=${box.left}`).toBe(true)
  })

  test('Super admin reachable from Account menu', async ({ page }) => {
    await page.goto('/auctions')
    await dismissWarn(page)
    await page.getByRole('button', { name: /dismiss warning/i }).click({ timeout: 2_000 }).catch(() => undefined)

    // Account ▾ always stays in the top bar — more reliable than Menu on phones.
    await page.getByRole('button', { name: /account menu/i }).click()
    const panel = page.locator('.me-menu-panel')
    await expect(panel).toBeVisible()
    const box = await panelOnScreen(page, '.me-menu-panel')
    expect(box.inView, `Account panel off-screen: left=${box.left}`).toBe(true)

    await panel.locator('a[href="/super"]').click()
    await expect(page).toHaveURL(/\/super/)
    await expect(page.getByRole('heading', { name: /super/i }).first()).toBeVisible()
  })
})

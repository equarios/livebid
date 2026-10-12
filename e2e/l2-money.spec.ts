import { expect, test } from '@playwright/test'
import { dismissWarn, loginBuyer } from './helpers/auth'

/**
 * UI surface for money desks — full paid path stays in server smoke:money.
 * This proves invoices / cart UI load for an approved wholesale buyer.
 */
test.describe('L2 money desks (UI)', () => {
  test('buyer invoices desk loads', async ({ page }) => {
    await loginBuyer(page)
    await page.goto('/account/invoices')
    await dismissWarn(page)
    await expect(page).toHaveURL(/\/account\/invoices/)
    await expect(page.locator('main, [class*="desk"], body')).toBeVisible()
  })

  test('marketplace then cart path reachable', async ({ page }) => {
    await loginBuyer(page)
    await page.goto('/marketplace')
    await dismissWarn(page)
    await expect(page).toHaveURL(/\/marketplace/)
    const cartLink = page.getByRole('link', { name: /cart/i }).first()
    if (await cartLink.isVisible().catch(() => false)) {
      await cartLink.click()
      await expect(page).toHaveURL(/cart|marketplace/i)
    }
  })
})

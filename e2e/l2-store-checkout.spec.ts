import { expect, test } from '@playwright/test'
import { dismissWarn, loginRetail } from './helpers/auth'

test.describe('L2 store checkout', () => {
  test('retail can open cart checkout surface', async ({ page }) => {
    await loginRetail(page)
    await page.goto('/store')
    await dismissWarn(page)
    const add = page.getByRole('button', { name: /add to cart/i }).first()
    await expect(add).toBeVisible({ timeout: 20_000 })
    await add.click()
    await page.goto('/store/cart')
    await expect(page).toHaveURL(/\/store\/cart/)
    await expect(page.getByText(/cart|checkout|total|qty|item/i).first()).toBeVisible()
    const checkout = page.getByRole('button', { name: /checkout|place order|pay|continue/i }).first()
    if (await checkout.isVisible().catch(() => false)) {
      await checkout.click()
      await expect(page.getByText(/email|address|payment|order|bank|paypal|card/i).first()).toBeVisible({
        timeout: 10_000,
      })
    }
  })
})

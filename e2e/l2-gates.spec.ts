import { expect, test } from '@playwright/test'
import { loginBuyer, loginRetail } from './helpers/auth'

test.describe('L2 access gates', () => {
  test('guest hitting /auctions is sent to login', async ({ page }) => {
    await page.goto('/auctions')
    await expect(page).toHaveURL(/\/login/)
  })

  test('buyer cannot open /admin', async ({ page }) => {
    await loginBuyer(page)
    await page.goto('/admin')
    await expect(page).not.toHaveURL(/\/admin$/)
  })

  test('buyer cannot open /super', async ({ page }) => {
    await loginBuyer(page)
    await page.goto('/super')
    await expect(page).not.toHaveURL(/\/super$/)
  })

  test('retail stays off wholesale auctions (redirect)', async ({ page }) => {
    await loginRetail(page)
    await page.goto('/auctions')
    // Retail is not wholesale-approved — should leave auctions desk
    await expect(page).not.toHaveURL(/\/auctions$/)
  })
})

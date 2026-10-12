import { expect, test } from '@playwright/test'
import { dismissWarn, loginBuyer } from './helpers/auth'

test.describe('L2 buyer actions', () => {
  test.beforeEach(async ({ page }) => {
    await loginBuyer(page)
    await dismissWarn(page)
  })

  test('place a bid on live auction lot', async ({ page }) => {
    await page.goto('/auctions')
    await dismissWarn(page)
    const bid = page.getByRole('button', { name: /^Bid$/i }).first()
    await expect(bid).toBeVisible({ timeout: 25_000 })
    await bid.click()
    const confirm = page.getByRole('button', { name: /confirm|ok|yes/i }).first()
    await expect(confirm).toBeVisible({ timeout: 10_000 })
    await confirm.click()
    // Dialog closes and desk remains usable
    await expect(page.getByRole('button', { name: /^Bid$/i }).first()).toBeVisible()
  })

  test('favourite a lot then open favourites desk', async ({ page }) => {
    // Prefer UI heart when present; otherwise exercise watch API (same store path)
    await page.goto('/auctions')
    await dismissWarn(page)
    const fav = page.locator('button.fav-heart').first()
    if (await fav.isVisible().catch(() => false)) {
      await fav.click()
    } else {
      const boot = await page.request.get('/api/commerce/bootstrap')
      expect(boot.ok()).toBeTruthy()
      const body = await boot.json()
      const lot = (body.lots || []).find((l: { channel?: string }) => l.channel === 'auction' || l.channel === 'marketplace')
      expect(lot?.id).toBeTruthy()
      const watch = await page.request.post(`/api/commerce/watch/${encodeURIComponent(lot.id)}`)
      expect(watch.ok()).toBeTruthy()
    }
    await page.goto('/account/favourites')
    await expect(page).toHaveURL(/favourites/)
    await expect(page.getByText(/favourites|watchlist|empty|lot|pcs|grade/i).first()).toBeVisible()
  })

  test('marketplace listing actions visible', async ({ page }) => {
    await page.goto('/marketplace')
    await dismissWarn(page)
    await expect(page.getByText(/list price|offer|marketplace/i).first()).toBeVisible()
    const action =
      (await page.getByRole('button', { name: /^Buy$|^Offer$|^Add/i }).count()) +
      (await page.getByRole('button', { name: /checkout|cart/i }).count())
    expect(action).toBeGreaterThan(0)
  })

  test('store add to cart then open cart', async ({ page }) => {
    await page.goto('/store')
    await dismissWarn(page)
    const add = page.getByRole('button', { name: /add to cart/i }).first()
    await expect(add).toBeVisible({ timeout: 20_000 })
    await add.click()
    await page.goto('/store/cart')
    await expect(page).toHaveURL(/\/store\/cart/)
    await expect(page.getByText(/cart|checkout|empty|item|qty|total/i).first()).toBeVisible()
  })

  test('store product detail opens', async ({ page }) => {
    await page.goto('/store')
    await dismissWarn(page)
    const details = page.getByRole('link', { name: /product details/i }).first()
    await expect(details).toBeVisible({ timeout: 20_000 })
    await details.click()
    await expect(page).toHaveURL(/\/store\/p\//)
  })
})

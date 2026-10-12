import { expect, test } from '@playwright/test'
import { loginAdmin, loginBuyer, loginSuper } from './helpers/auth'

test.describe('L2 wholesale desks (buyer)', () => {
  test.beforeEach(async ({ page }) => {
    await loginBuyer(page)
  })

  test('auctions desk loads', async ({ page }) => {
    await page.goto('/auctions')
    await expect(page).toHaveURL(/\/auctions/)
    await expect(page.getByRole('button', { name: /^Bid$/i }).first()).toBeVisible({ timeout: 25_000 })
    await expect(page.getByRole('heading', { name: /live auctions|auctions|offline/i }).first()).toBeVisible()
  })

  test('marketplace desk loads', async ({ page }) => {
    await page.goto('/marketplace')
    await expect(page).toHaveURL(/\/marketplace/)
    await expect(page.getByText(/list price|offer|marketplace|سوق|marché/i).first()).toBeVisible()
  })

  test('account / my page loads', async ({ page }) => {
    await page.goto('/account')
    await expect(page).toHaveURL(/\/account/)
    await expect(page.getByText(/my page|account|wholesale|صفحتي|compte/i).first()).toBeVisible()
  })

  test('invoices route loads', async ({ page }) => {
    await page.goto('/account/invoices')
    await expect(page).toHaveURL(/\/account\/invoices|\/invoices/)
  })

  test('favourites route loads', async ({ page }) => {
    await page.goto('/account/favourites')
    await expect(page).toHaveURL(/favourites|watchlist/)
  })

  test('SEO category phones loads (public chrome ok while logged in)', async ({ page }) => {
    await page.goto('/wholesale/c/phones')
    await expect(page).toHaveURL(/\/wholesale\/c\/phones/)
    await expect(page.getByRole('heading', { name: /mobile phones|هواتف|téléphones/i })).toBeVisible()
  })
})

test.describe('L2 store (retail surface)', () => {
  test('store catalog loads for buyer session', async ({ page }) => {
    await loginBuyer(page)
    await page.goto('/store')
    await expect(page).toHaveURL(/\/store/)
    await expect(page.getByRole('heading', { name: /store|متجر|boutique/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /add to cart|أضف|ajouter/i }).first()).toBeVisible()
  })
})

test.describe('L2 staff desks', () => {
  test('admin desk loads for admin', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin/)
    await expect(page.getByText(/admin|ops|desk|inventory|clients/i).first()).toBeVisible()
  })

  test('super desk loads for super', async ({ page }) => {
    await loginSuper(page)
    await page.goto('/super')
    await expect(page).toHaveURL(/\/super/)
    await expect(page.getByText(/super|copy|fees|settings|accounts/i).first()).toBeVisible()
  })
})

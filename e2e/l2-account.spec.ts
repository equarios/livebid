import { expect, test } from '@playwright/test'
import { dismissWarn, loginBuyer, loginRetail } from './helpers/auth'

const BUYER_ACCOUNT_PATHS = [
  '/account',
  '/account/documents',
  '/account/bids',
  '/account/marketplace-history',
  '/account/favourites',
  '/account/invoices',
  '/account/imei',
  '/account/settings',
  '/account/complaint',
  '/account/wholesale',
  '/account/community',
]

test.describe('L2 account desk (buyer)', () => {
  test.beforeEach(async ({ page }) => {
    await loginBuyer(page)
    await dismissWarn(page)
  })

  for (const path of BUYER_ACCOUNT_PATHS) {
    test(`loads ${path}`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      await expect(page.locator('body')).toBeVisible()
    })
  }
})

test.describe('L2 retail account', () => {
  test('retail can open store orders and wholesale apply', async ({ page }) => {
    await loginRetail(page)
    await dismissWarn(page)
    await page.goto('/store/orders')
    await expect(page).toHaveURL(/\/store\/orders/)
    await page.goto('/account/wholesale')
    await expect(page).toHaveURL(/\/account\/wholesale/)
  })

  test('retail community is gated away from peer board', async ({ page }) => {
    await loginRetail(page)
    await page.goto('/account/community')
    // Not wholesale-approved → redirect to wholesale apply
    await expect(page).toHaveURL(/\/account\/wholesale|\/account$/)
  })
})

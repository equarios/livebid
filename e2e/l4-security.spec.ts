import { expect, test } from '@playwright/test'
import { loginBuyer, loginRetail, loginAdmin } from './helpers/auth'

test.describe('L4 security UI gates', () => {
  test('after logout, wholesale desk sends guest to login', async ({ page }) => {
    await loginBuyer(page)
    await page.goto('/account')
    await expect(page).toHaveURL(/\/account/)
    // Prefer UI logout if present; else clear via API cookie path
    const logout = page.getByRole('button', { name: /log out|sign out|logout/i }).first()
    if (await logout.isVisible().catch(() => false)) {
      await logout.click()
    } else {
      await page.request.post('/api/auth/logout')
      await page.goto('/auctions')
    }
    await page.goto('/auctions')
    await expect(page).toHaveURL(/\/login/)
  })

  test('retail cannot open community peer board', async ({ page }) => {
    await loginRetail(page)
    await page.goto('/account/community')
    await expect(page).not.toHaveURL(/\/account\/community$/)
  })

  test('admin can open admin; retail still blocked from admin', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin/)

    await page.request.post('/api/auth/logout')
    await loginRetail(page)
    await page.goto('/admin')
    await expect(page).not.toHaveURL(/\/admin$/)
  })

  test('buyer blocked from super desk', async ({ page }) => {
    await loginBuyer(page)
    await page.goto('/super')
    await expect(page).not.toHaveURL(/\/super$/)
  })
})

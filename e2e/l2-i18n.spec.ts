import { expect, test } from '@playwright/test'
import { dismissWarn, loginBuyer } from './helpers/auth'

test.describe('L2 i18n', () => {
  test('language menu lists many locales and Arabic sets RTL', async ({ page }) => {
    await loginBuyer(page)
    await dismissWarn(page)
    await page.goto('/auctions')
    await dismissWarn(page)

    await page.getByRole('button', { name: /^Language$|^اللغة$/i }).click()
    const list = page.getByRole('listbox', { name: /language|اللغة/i })
    await expect(list).toBeVisible()
    await expect(list.getByRole('option')).toHaveCount(22)

    await list.getByRole('button', { name: 'العربية' }).click()
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

    // Restore English for other tests in this worker (workers=1 but keep tidy)
    await page.getByRole('button', { name: /اللغة|language/i }).click()
    await page.getByRole('button', { name: 'English' }).click()
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  })

  test('?lang=ja applies from SEO landing', async ({ page }) => {
    await page.goto('/wholesale/c/phones?lang=ja')
    await expect(page.locator('html')).toHaveAttribute('lang', /ja/i)
  })
})

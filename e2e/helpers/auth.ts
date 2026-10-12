import type { Page } from '@playwright/test'

/** Dismiss site warning toast if present so it does not block clicks. */
export async function dismissWarn(page: Page) {
  const btn = page.getByRole('button', { name: /dismiss warning/i })
  if (await btn.isVisible().catch(() => false)) {
    await btn.click().catch(() => {})
  }
}

/** Two-step login used by Equarios Sign in. */
export async function loginAs(page: Page, ident: string, password: string) {
  await page.goto('/login')
  await page.evaluate(() => {
    try {
      localStorage.setItem('livebid-locale', 'en')
    } catch {
      /* ignore */
    }
  })
  await page.reload()
  await page.getByPlaceholder(/email address/i).fill(ident)
  await page.getByRole('button', { name: /let'?s go/i }).click()
  await page.getByPlaceholder(/^password$/i).fill(password)
  await page.getByRole('button', { name: /sign in|log in|تسجيل الدخول/i }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 })
  await dismissWarn(page)
}

export async function loginBuyer(page: Page) {
  await loginAs(page, 'DEMO-1001', 'livebid')
}

export async function loginAdmin(page: Page) {
  await loginAs(page, 'ADMIN-0001', 'admin')
}

export async function loginSuper(page: Page) {
  await loginAs(page, 'SUPER-0001', 'super')
}

export async function loginRetail(page: Page) {
  await loginAs(page, 'RETAIL-1001', 'retail')
}

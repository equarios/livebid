import type { Page } from '@playwright/test'

/** Dismiss site warning popup if present. */
export async function dismissWarn(page: Page) {
  const btn = page.getByRole('button', { name: /dismiss warning/i })
  if (await btn.isVisible().catch(() => false)) {
    await btn.click().catch(() => undefined)
  }
}

export async function gotoDesk(page: Page, path: string) {
  await page.goto(path)
  await dismissWarn(page)
}

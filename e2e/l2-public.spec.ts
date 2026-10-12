import { expect, test } from '@playwright/test'

test.describe('L2 public / marketing / SEO', () => {
  test('buyers page', async ({ page }) => {
    await page.goto('/buyers')
    await expect(page).toHaveURL(/\/buyers/)
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  test('sellers page', async ({ page }) => {
    await page.goto('/sellers')
    await expect(page).toHaveURL(/\/sellers/)
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  test('support page', async ({ page }) => {
    await page.goto('/support')
    await expect(page).toHaveURL(/\/support/)
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  test('tutorial page', async ({ page }) => {
    await page.goto('/tutorial')
    await expect(page).toHaveURL(/\/login|\/tutorial/)
  })

  test('register page', async ({ page }) => {
    await page.goto('/register')
    await expect(page).toHaveURL(/\/register/)
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  test('wholesale hub guest', async ({ page }) => {
    await page.goto('/wholesale')
    await expect(page).toHaveURL(/\/wholesale/)
  })

  test('SEO hub /wholesale/c', async ({ page }) => {
    await page.goto('/wholesale/c')
    await expect(page.getByRole('heading', { name: /buy & sell devices worldwide/i })).toBeVisible()
  })

  test('SEO phones unlocked', async ({ page }) => {
    await page.goto('/wholesale/c/phones/unlocked')
    await expect(page).toHaveURL(/\/wholesale\/c\/phones\/unlocked/)
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  test('SEO phones unlocked apple', async ({ page }) => {
    await page.goto('/wholesale/c/phones/unlocked/apple')
    await expect(page).toHaveURL(/\/wholesale\/c\/phones\/unlocked\/apple/)
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  test('SEO tablets refurbished', async ({ page }) => {
    await page.goto('/wholesale/c/tablets/refurbished')
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  test('SEO consoles', async ({ page }) => {
    await page.goto('/wholesale/c/consoles')
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  test('SEO scrap phones', async ({ page }) => {
    await page.goto('/wholesale/c/phones/scrap')
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  test('robots.txt served', async ({ page }) => {
    const res = await page.request.get('/robots.txt')
    expect(res.ok()).toBeTruthy()
    const text = await res.text()
    expect(text).toMatch(/Sitemap:/i)
    for (const path of ['/admin', '/super', '/account', '/auctions', '/marketplace', '/login', '/register']) {
      expect(text).toMatch(new RegExp(`Disallow:\\s*${path.replace('/', '\\/')}`))
    }
  })

  test('sitemap.xml served', async ({ page }) => {
    const res = await page.request.get('/sitemap.xml')
    expect(res.ok()).toBeTruthy()
    const text = await res.text()
    expect(text).toMatch(/<urlset|<url>/i)
  })
})

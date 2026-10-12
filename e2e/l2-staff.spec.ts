import { expect, test } from '@playwright/test'
import { dismissWarn, loginAdmin, loginSuper } from './helpers/auth'

test.describe('L2 admin desk sections', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page)
    await dismissWarn(page)
  })

  test('admin home', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin/)
    await expect(page.getByText(/admin|ops|today|inventory|invoice/i).first()).toBeVisible()
  })

  test('admin money section', async ({ page }) => {
    await page.goto('/admin?section=money')
    await expect(page).toHaveURL(/section=money/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('admin imei section', async ({ page }) => {
    await page.goto('/admin?section=imei')
    await expect(page).toHaveURL(/section=imei/)
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('L2 super desk sections', () => {
  test.beforeEach(async ({ page }) => {
    await loginSuper(page)
    await dismissWarn(page)
  })

  test('super home', async ({ page }) => {
    await page.goto('/super')
    await expect(page).toHaveURL(/\/super/)
    await expect(page.getByText(/super|today|people|settings|catalog/i).first()).toBeVisible()
  })

  test('super people', async ({ page }) => {
    await page.goto('/super?section=people')
    await expect(page).toHaveURL(/section=people/)
  })

  test('super money', async ({ page }) => {
    await page.goto('/super?section=money')
    await expect(page).toHaveURL(/section=money/)
  })

  test('super catalog', async ({ page }) => {
    await page.goto('/super?section=catalog')
    await expect(page).toHaveURL(/section=catalog/)
  })

  test('super settings site', async ({ page }) => {
    await page.goto('/super?section=settings&desk=site')
    await expect(page).toHaveURL(/section=settings/)
  })

  test('super store desk', async ({ page }) => {
    await page.goto('/super?section=store')
    await expect(page).toHaveURL(/section=store/)
  })
})

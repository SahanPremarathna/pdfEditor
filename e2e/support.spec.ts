import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { E2E_KOFI_URL, forceInputFallback, openFixture, SHOTS } from './helpers'

/*
 * The donation experience: always optional, never in the way. Saving must
 * work exactly as before; the thank-you card only appears after an
 * export and can be turned off for good.
 */

async function saveOnce(page: Page): Promise<void> {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /^Save/ }).click()
  await download
}

test('welcome page makes the free-forever promise and offers support', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Free on the surface\?/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Kept free by people like you' })).toBeVisible()
  await expect(page.getByText('Made with')).toBeVisible()
  await expect(page.getByText('by Test Maker')).toBeVisible()

  const kofi = page.getByRole('link', { name: 'Support on Ko-fi' }).first()
  await expect(kofi).toHaveAttribute('href', E2E_KOFI_URL)
  await expect(kofi).toHaveAttribute('target', '_blank')
  await expect(kofi).toHaveAttribute('rel', /noopener/)

  // Visible without scrolling: the coffee link right under the hero.
  const coffee = page.getByRole('link', { name: /Buy me a coffee/ })
  await expect(coffee).toBeInViewport()
  await expect(coffee).toHaveAttribute('href', E2E_KOFI_URL)

  await page.waitForTimeout(800)
  await page.screenshot({ path: join(SHOTS, 'support-welcome-light.png'), fullPage: true })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForTimeout(300)
  await page.screenshot({ path: join(SHOTS, 'support-welcome-dark.png'), fullPage: true })
})

test('support dialog: Ko-fi opens in a new tab, share copies the link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await page.getByRole('button', { name: 'Support TrueFreePDF' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Support TrueFreePDF' })
  await expect(dialog.getByRole('heading', { name: /Really free/ })).toBeVisible()
  await page.waitForTimeout(600)
  await page.screenshot({ path: join(SHOTS, 'support-modal.png') })

  await dialog.getByRole('button', { name: 'Share TrueFreePDF' }).click()
  await expect(dialog.getByText('Link copied!')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('http://localhost:4173/')

  // Ko-fi opens in its own tab; the app tab stays put. (The popup is aborted
  // before it reaches the network.)
  await context.route('https://ko-fi.com/**', (route) => route.abort())
  const popup = context.waitForEvent('page')
  await dialog.getByRole('link', { name: 'Support on Ko-fi' }).click()
  await (await popup).close()
  await expect(dialog.getByText(/Thank you/)).toBeVisible()
  expect(page.url()).toBe('http://localhost:4173/')

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('thank-you card appears after an export and can be switched off for good', async ({ page }) => {
  await forceInputFallback(page)
  await page.goto('/')
  await openFixture(page)
  const card = page.getByRole('complementary', { name: 'Support TrueFreePDF' })
  await expect(card).toHaveCount(0)

  await saveOnce(page)
  await expect(card).toBeVisible()
  await expect(card.getByText('Saved — free, as always.')).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(SHOTS, 'support-nudge.png') })

  await card.getByRole('button', { name: "Don't show again" }).click()
  await expect(card).toHaveCount(0)

  // Across a reload and many more exports: never again.
  await page.reload()
  await openFixture(page)
  for (let i = 0; i < 3; i++) await saveOnce(page)
  await page.waitForTimeout(400)
  await expect(card).toHaveCount(0)
})

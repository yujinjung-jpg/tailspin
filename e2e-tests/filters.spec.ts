import { test, expect } from '@playwright/test';

test.describe('Game filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows all games with no filters applied', async ({ page }) => {
    const total = await page.getByTestId('game-card').count();
    expect(total).toBeGreaterThan(0);
    await expect(page.getByTestId('results-count')).toHaveText(`Showing ${total} of ${total} games`);
  });

  test('filters by one or more categories', async ({ page }) => {
    const boxes = page.locator('[data-testid^="category-filter-"]');
    await boxes.nth(0).check();
    const first = await page.locator('[data-testid="game-card"]:visible').count();
    expect(first).toBeGreaterThan(0);
    const name = (await boxes.nth(0).locator('xpath=..').innerText()).trim();
    for (const tag of await page.locator('[data-testid="game-card"]:visible [data-testid="game-category"]').allInnerTexts()) {
      expect(tag.trim()).toBe(name);
    }

    await boxes.nth(1).check();
    const both = await page.locator('[data-testid="game-card"]:visible').count();
    expect(both).toBeGreaterThanOrEqual(first);
  });

  test('filters by publisher', async ({ page }) => {
    const select = page.getByTestId('publisher-filter');
    await select.selectOption({ index: 1 });
    const name = (await select.locator('option:checked').innerText()).trim();
    const tags = page.locator('[data-testid="game-card"]:visible [data-testid="game-publisher"]');
    expect(await tags.count()).toBeGreaterThan(0);
    for (const tag of await tags.allInnerTexts()) {
      expect(tag.trim()).toBe(name);
    }
  });

  test('combines category and publisher filters and can be cleared', async ({ page }) => {
    const total = await page.getByTestId('game-card').count();
    await page.locator('[data-testid^="category-filter-"]').first().check();
    const categoryOnly = await page.locator('[data-testid="game-card"]:visible').count();
    await page.getByTestId('publisher-filter').selectOption({ index: 1 });
    const combined = await page.locator('[data-testid="game-card"]:visible').count();
    expect(combined).toBeLessThanOrEqual(categoryOnly);

    await page.getByTestId('clear-filters').click();
    await expect(page.getByTestId('results-count')).toHaveText(`Showing ${total} of ${total} games`);
    await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(total);
  });

  test('restores filters from the URL and is keyboard operable', async ({ page }) => {
    const box = page.locator('[data-testid^="category-filter-"]').first();
    await box.focus();
    await page.keyboard.press('Space');
    await expect(box).toBeChecked();
    await expect(page).toHaveURL(/\?category=\d+/);
    await page.reload();
    await expect(box).toBeChecked();
  });
});

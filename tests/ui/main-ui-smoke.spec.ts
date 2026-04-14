import { expect, test } from '@playwright/test';

test.describe('Main UI smoke flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#header-action-group')).toBeVisible();
    await expect(page.locator('#preview-shape-bar')).toBeVisible();
  });

  test('shader dialog open, switch stage, and close', async ({ page }) => {
    const openButton = page.locator('#btn-open-shader-dialog');
    const dialog = page.locator('#shader-dialog');

    await openButton.click();
    await expect(dialog).toHaveJSProperty('open', true);
    await expect(page.locator('#shader-dialog-title')).toBeVisible();

    const hlslTab = page.locator('[data-shader-stage="hlsl-fragment"]');
    await hlslTab.click();
    await expect(hlslTab).toHaveAttribute('aria-pressed', 'true');

    const codeOutput = page.locator('#shader-dialog pre');
    await expect(codeOutput).toBeVisible();
    await expect(codeOutput).not.toHaveText('');

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveJSProperty('open', false);
  });

  test('auto apply can be toggled from header', async ({ page }) => {
    const autoApply = page.locator('#chk-auto-apply');
    await expect(autoApply).toBeVisible();

    const before = await autoApply.isChecked();
    if (before) {
      await autoApply.uncheck();
      await expect(autoApply).not.toBeChecked();
      await autoApply.check();
      await expect(autoApply).toBeChecked();
    } else {
      await autoApply.check();
      await expect(autoApply).toBeChecked();
      await autoApply.uncheck();
      await expect(autoApply).not.toBeChecked();
    }
  });

  test('preview shape buttons are clickable', async ({ page }) => {
    const sphereButton = page.locator('#preview-shape-bar button', { hasText: 'Sphere' });
    const cubeButton = page.locator('#preview-shape-bar button', { hasText: 'Cube' });
    const torusButton = page.locator('#preview-shape-bar button', { hasText: 'Torus' });

    await expect(sphereButton).toBeVisible();
    await expect(cubeButton).toBeVisible();
    await expect(torusButton).toBeVisible();

    await cubeButton.click();
    await torusButton.click();
    await sphereButton.click();
  });

  test('lut strip supports drag reorder when at least two LUTs exist', async ({ page }) => {
    const lutItems = page.locator('[data-lut-item="true"]');
    const count = await lutItems.count();
    test.skip(count < 2, 'LUT reorder test requires at least two LUT items.');

    const firstBefore = await lutItems.first().getAttribute('data-lut-id');
    await lutItems.nth(0).dragTo(lutItems.nth(1));

    await expect
      .poll(async () => page.locator('[data-lut-item="true"]').first().getAttribute('data-lut-id'))
      .not.toBe(firstBefore);
  });
});
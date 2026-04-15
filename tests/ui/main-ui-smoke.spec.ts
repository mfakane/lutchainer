import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.describe('Main UI smoke flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#header-action-group')).toBeVisible();
    await expect(page.locator('#preview-shape-bar')).toBeVisible();
  });

  test('shader dialog open, switch stage, and close', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: 'Open export menu' });
    const openCodeItem = page.getByRole('menuitem', { name: 'Show generated shader' });
    const dialog = page.locator('#shader-dialog');

    await exportButton.click();
    await openCodeItem.click();
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

  test('header does not expose manual apply controls', async ({ page }) => {
    await expect(page.locator('#chk-auto-apply')).toHaveCount(0);
    await expect(page.locator('#btn-apply-pipeline')).toHaveCount(0);
    await expect(page.locator('#statusbar')).toHaveText('');
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

  test('dropping a .lutchain file shows overlay and loads the pipeline', async ({ page }) => {
    const archiveBytes = await readFile(new URL('../../examples/HueShiftToon.lutchain', import.meta.url));
    const dataTransfer = await page.evaluateHandle(({ bytes }) => {
      const nextDataTransfer = new DataTransfer();
      nextDataTransfer.items.add(
        new File([new Uint8Array(bytes)], 'HueShiftToon.lutchain', {
          type: '', // The .lutchain extension is unlikely to have a registered MIME type, so use an empty string to simulate that scenario.
        }),
      );
      return nextDataTransfer;
    }, { bytes: Array.from(archiveBytes) });

    const body = page.locator('body');
    const overlay = page.locator('#pipeline-file-drop-overlay');
    const lutOverlay = page.locator('#lut-file-drop-overlay');

    await body.dispatchEvent('dragenter', { dataTransfer });
    await expect(overlay).toHaveAttribute('data-active', 'true');
    await expect(lutOverlay).toHaveAttribute('data-active', 'false');

    await body.dispatchEvent('dragover', { dataTransfer });
    await body.dispatchEvent('drop', { dataTransfer });

    await expect(overlay).toHaveAttribute('data-active', 'false');
    await expect.poll(async () => page.locator('[data-step-item="true"]').count()).toBeGreaterThan(0);
  });

  test('dropping an image shows LUT overlay and adds it to the LUT library', async ({ page }) => {
    const dataTransfer = await page.evaluateHandle(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 4;
      canvas.height = 4;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Failed to get 2D context');
      }

      context.fillStyle = '#ff0000';
      context.fillRect(0, 0, 2, 4);
      context.fillStyle = '#00ff00';
      context.fillRect(2, 0, 2, 4);

      const nextDataTransfer = new DataTransfer();
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1] ?? '';
      const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
      nextDataTransfer.items.add(new File([bytes], 'dropped-lut.png', { type: 'image/png' }));
      return nextDataTransfer;
    });

    const body = page.locator('body');
    const pipelineOverlay = page.locator('#pipeline-file-drop-overlay');
    const lutOverlay = page.locator('#lut-file-drop-overlay');
    const beforeCount = await page.locator('[data-lut-item="true"]').count();

    await body.dispatchEvent('dragenter', { dataTransfer });
    await expect(pipelineOverlay).toHaveAttribute('data-active', 'false');
    await expect(lutOverlay).toHaveAttribute('data-active', 'true');

    await body.dispatchEvent('dragover', { dataTransfer });
    await body.dispatchEvent('drop', { dataTransfer });

    await expect(lutOverlay).toHaveAttribute('data-active', 'false');
    await expect.poll(async () => page.locator('[data-lut-item="true"]').count()).toBe(beforeCount + 1);
  });
});

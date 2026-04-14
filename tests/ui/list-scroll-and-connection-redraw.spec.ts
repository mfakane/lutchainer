import { expect, test, type Locator, type Page } from '@playwright/test';

type ScrollMetrics = {
  scrollTop: number;
  scrollLeft: number;
  scrollHeight: number;
  scrollWidth: number;
  clientHeight: number;
  clientWidth: number;
};

async function getScrollMetrics(locator: Locator): Promise<ScrollMetrics> {
  return locator.evaluate(element => ({
    scrollTop: element.scrollTop,
    scrollLeft: element.scrollLeft,
    scrollHeight: element.scrollHeight,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    clientWidth: element.clientWidth,
  }));
}

async function setScrollPosition(locator: Locator, next: { top?: number; left?: number }): Promise<void> {
  await locator.evaluate((element, position) => {
    if (typeof position.top === 'number') {
      element.scrollTop = position.top;
    }
    if (typeof position.left === 'number') {
      element.scrollLeft = position.left;
    }
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  }, next);
}

async function installConnectionRedrawProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    type ProbeWindow = Window & {
      __connectionRedrawProbeInstalled?: boolean;
      __connectionRedrawCount?: number;
      __connectionRedrawOriginalSetAttribute?: typeof SVGPathElement.prototype.setAttribute;
    };

    const probeWindow = window as ProbeWindow;
    if (probeWindow.__connectionRedrawProbeInstalled) {
      probeWindow.__connectionRedrawCount = 0;
      return;
    }

    const originalSetAttribute = SVGPathElement.prototype.setAttribute;
    probeWindow.__connectionRedrawOriginalSetAttribute = originalSetAttribute;
    probeWindow.__connectionRedrawCount = 0;

    SVGPathElement.prototype.setAttribute = function patchedSetAttribute(name: string, value: string): void {
      if (name === 'd' && this.closest('#connection-layer')) {
        probeWindow.__connectionRedrawCount = (probeWindow.__connectionRedrawCount ?? 0) + 1;
      }
      originalSetAttribute.call(this, name, value);
    };

    probeWindow.__connectionRedrawProbeInstalled = true;
  });
}

async function resetConnectionRedrawProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    type ProbeWindow = Window & { __connectionRedrawCount?: number };
    (window as ProbeWindow).__connectionRedrawCount = 0;
  });
}

async function getConnectionRedrawCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    type ProbeWindow = Window & { __connectionRedrawCount?: number };
    return (window as ProbeWindow).__connectionRedrawCount ?? 0;
  });
}

async function getVisibleDataId(
  page: Page,
  rootSelector: string,
  itemSelector: string,
  dataKey: string,
): Promise<string> {
  const result = await page.evaluate(({ rootSelector, itemSelector, dataKey }) => {
    const root = document.querySelector<HTMLElement>(rootSelector);
    if (!(root instanceof HTMLElement)) {
      return null;
    }

    const rootRect = root.getBoundingClientRect();
    const items = Array.from(root.querySelectorAll<HTMLElement>(itemSelector));
    const visibleItem = items.find(item => {
      const rect = item.getBoundingClientRect();
      return rect.width > 0
        && rect.height > 0
        && rect.top < rootRect.bottom
        && rect.bottom > rootRect.top
        && rect.left < rootRect.right
        && rect.right > rootRect.left;
    });

    return visibleItem?.dataset[dataKey] ?? null;
  }, { rootSelector, itemSelector, dataKey });

  if (typeof result !== 'string' || result.length === 0) {
    throw new Error(`Visible item with data key ${dataKey} was not found for ${itemSelector}.`);
  }

  return result;
}

async function addSteps(page: Page, count: number): Promise<void> {
  const addButton = page.getByRole('button', { name: 'Add Step' });
  for (let index = 0; index < count; index += 1) {
    await addButton.click();
  }
}

async function addCustomParams(page: Page, count: number): Promise<void> {
  const addButton = page.getByRole('button', { name: 'Add Param' });
  for (let index = 0; index < count; index += 1) {
    await addButton.click();
  }
}

async function duplicateLutById(page: Page, lutId: string): Promise<void> {
  const lutItem = page.locator(`[data-lut-item="true"][data-lut-id="${lutId}"]`);
  await expect(lutItem).toBeVisible();
  await lutItem.getByRole('button').click();
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
}

async function ensureLutLibraryScrollable(page: Page): Promise<void> {
  const scrollRoot = page.locator('#lut-strip-list > div').first();
  for (let index = 0; index < 10; index += 1) {
    const metrics = await getScrollMetrics(scrollRoot);
    if (metrics.scrollWidth > metrics.clientWidth + 24) {
      return;
    }

    const lutId = await getVisibleDataId(page, '#lut-strip-list > div', '[data-lut-item="true"]', 'lutId');
    await duplicateLutById(page, lutId);
  }

  const finalMetrics = await getScrollMetrics(scrollRoot);
  expect(finalMetrics.scrollWidth).toBeGreaterThan(finalMetrics.clientWidth + 24);
}

function expectCloseEnough(actual: number, expected: number, tolerance: number, label: string): void {
  expect(Math.abs(actual - expected), `${label}: expected ${actual} to be within ${tolerance} of ${expected}`).toBeLessThanOrEqual(tolerance);
}

test.describe('List scroll retention and connection redraw', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#connection-layer')).toBeVisible();
    await installConnectionRedrawProbe(page);
  });

  test('step list keeps scroll position and redraws connections on scroll and edit', async ({ page }) => {
    await addSteps(page, 18);

    const stepItems = page.locator('[data-step-item="true"]');
    await expect(stepItems).toHaveCount(18);

    const firstStepId = await stepItems.first().getAttribute('data-step-id');
    expect(firstStepId).toBeTruthy();

    const pathLocator = page.locator(`#connection-layer path[data-connection-key="step-${firstStepId}-x"]`);
    await expect(pathLocator).toBeVisible();
    const initialPath = await pathLocator.getAttribute('d');
    expect(initialPath).toBeTruthy();

    const stepScrollRoot = page.locator('#step-column > div').first();
    const initialMetrics = await getScrollMetrics(stepScrollRoot);
    expect(initialMetrics.scrollHeight).toBeGreaterThan(initialMetrics.clientHeight + 24);

    await resetConnectionRedrawProbe(page);
    const targetScrollTop = Math.min(initialMetrics.scrollHeight - initialMetrics.clientHeight, 420);
    await setScrollPosition(stepScrollRoot, { top: targetScrollTop });
    
    // Wait for scroll position to stabilize
    await expect.poll(async () => (await getScrollMetrics(stepScrollRoot)).scrollTop).toBe(targetScrollTop);
    await expect.poll(async () => await pathLocator.getAttribute('d')).not.toBe(initialPath);
    await expect.poll(async () => await getConnectionRedrawCount(page)).toBeGreaterThan(0);

    await resetConnectionRedrawProbe(page);
    const scrollBeforeEdit = (await getScrollMetrics(stepScrollRoot)).scrollTop;
    const visibleStepId = await getVisibleDataId(page, '#step-column > div', '[data-step-item="true"]', 'stepId');
    const visibleStep = page.locator(`[data-step-item="true"][data-step-id="${visibleStepId}"]`);
    await visibleStep.getByRole('button', { name: 'Duplicate' }).click();

    await expect(stepItems).toHaveCount(19);
    // Wait for DOM to stabilize before checking scroll position
    await page.locator('[data-step-item="true"]').nth(0).waitFor({ state: 'attached' });
    await expect.poll(async () => await getConnectionRedrawCount(page)).toBeGreaterThan(0);

    const scrollAfterEdit = (await getScrollMetrics(stepScrollRoot)).scrollTop;
    expectCloseEnough(scrollAfterEdit, scrollBeforeEdit, 8, 'step list scrollTop');
  });

  test('parameter list keeps scroll position and redraws connections on scroll and edit', async ({ page }) => {
    await addSteps(page, 2);
    await addCustomParams(page, 18);

    const stepId = await page.locator('[data-step-item="true"]').first().getAttribute('data-step-id');
    expect(stepId).toBeTruthy();

    const pathLocator = page.locator(`#connection-layer path[data-connection-key="step-${stepId}-x"]`);
    await expect(pathLocator).toBeVisible();
    const initialPath = await pathLocator.getAttribute('d');
    expect(initialPath).toBeTruthy();

    const paramScrollRoot = page.locator('.param-column');
    const initialMetrics = await getScrollMetrics(paramScrollRoot);
    expect(initialMetrics.scrollHeight).toBeGreaterThan(initialMetrics.clientHeight + 24);

    await resetConnectionRedrawProbe(page);
    await setScrollPosition(paramScrollRoot, { top: initialMetrics.scrollHeight - initialMetrics.clientHeight });

    await expect.poll(async () => await pathLocator.getAttribute('d')).not.toBe(initialPath);
    await expect.poll(async () => await getConnectionRedrawCount(page)).toBeGreaterThan(0);

    await resetConnectionRedrawProbe(page);
    const scrollBeforeEdit = (await getScrollMetrics(paramScrollRoot)).scrollTop;
    const visibleParamId = await getVisibleDataId(page, '.param-column', '[data-custom-param-item="true"]', 'paramId');
    const slider = page.locator(`[data-custom-param-item="true"][data-param-id="${visibleParamId}"] input[type="range"]`).first();
    const valueLabel = page.locator(`[data-custom-param-item="true"][data-param-id="${visibleParamId}"] [data-part="custom-param-value"]`).first();
    await slider.evaluate(element => {
      const input = element as HTMLInputElement;
      input.value = '0.73';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await expect(valueLabel).toHaveText('0.73');
    await expect.poll(async () => await getConnectionRedrawCount(page)).toBeGreaterThan(0);

    const scrollAfterEdit = (await getScrollMetrics(paramScrollRoot)).scrollTop;
    expectCloseEnough(scrollAfterEdit, scrollBeforeEdit, 8, 'parameter list scrollTop');
  });

  test('lut library keeps horizontal scroll position after edit', async ({ page }) => {
    await ensureLutLibraryScrollable(page);

    const lutScrollRoot = page.locator('#lut-strip-list > div').first();
    const metrics = await getScrollMetrics(lutScrollRoot);
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth + 24);

    await setScrollPosition(lutScrollRoot, { left: Math.min(metrics.scrollWidth - metrics.clientWidth, 480) });
    const scrollBeforeEdit = (await getScrollMetrics(lutScrollRoot)).scrollLeft;

    const visibleLutId = await getVisibleDataId(page, '#lut-strip-list > div', '[data-lut-item="true"]', 'lutId');
    const beforeCount = await page.locator('[data-lut-item="true"]').count();
    await duplicateLutById(page, visibleLutId);
    await expect(page.locator('[data-lut-item="true"]')).toHaveCount(beforeCount + 1);

    const scrollAfterEdit = (await getScrollMetrics(lutScrollRoot)).scrollLeft;
    expectCloseEnough(scrollAfterEdit, scrollBeforeEdit, 8, 'lut library scrollLeft');
  });
});
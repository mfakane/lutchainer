import type { LutModel } from '../step/step-model';

export function buildSampleBody(
  luts: readonly LutModel[],
  fallbackExpr: string,
  sampleExprAtIndex: (index: number) => string,
): string {
  if (!Array.isArray(luts)) {
    throw new Error('LUT list が不正です。');
  }
  if (typeof fallbackExpr !== 'string' || fallbackExpr.trim().length === 0) {
    throw new Error('fallbackExpr が不正です。');
  }
  if (typeof sampleExprAtIndex !== 'function') {
    throw new Error('sampleExprAtIndex が不正です。');
  }

  if (luts.length === 0) {
    return `return ${fallbackExpr};`;
  }

  const lines: string[] = [];
  for (let index = 0; index < luts.length; index += 1) {
    const sampleExpr = sampleExprAtIndex(index);
    if (typeof sampleExpr !== 'string' || sampleExpr.trim().length === 0) {
      throw new Error(`sampleExprAtIndex(${index}) が不正です。`);
    }

    if (index === 0) {
      lines.push(`if (lutIndex == ${index}) return ${sampleExpr};`);
    } else {
      lines.push(`else if (lutIndex == ${index}) return ${sampleExpr};`);
    }
  }

  lines.push(`return ${sampleExprAtIndex(0)};`);
  return lines.join('\n  ');
}

import type { CustomParamModel, LutModel, StepModel } from '../step/step-model';
import { parseCustomParamRef } from '../step/step-model';

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

export function collectUsedCustomParams(
  steps: readonly StepModel[],
  customParams: readonly CustomParamModel[],
): CustomParamModel[] {
  const customParamMap = new Map(customParams.map(param => [param.id, param] as const));
  const usedCustomParamIds = new Set<string>();

  for (const step of steps) {
    const xParamId = parseCustomParamRef(step.xParam);
    const yParamId = parseCustomParamRef(step.yParam);
    if (xParamId) {
      usedCustomParamIds.add(xParamId);
    }
    if (yParamId) {
      usedCustomParamIds.add(yParamId);
    }
  }

  return [...usedCustomParamIds]
    .map(id => customParamMap.get(id) ?? null)
    .filter((param): param is CustomParamModel => param !== null);
}

export function buildCustomUniformDeclarations(customParams: readonly CustomParamModel[], keyword = 'uniform float'): string {
  return customParams.map(param => `${keyword} u_param_${param.id};`).join('\n');
}

export function buildCustomUniformComments(customParams: readonly CustomParamModel[], prefix = '//'): string {
  if (customParams.length === 0) {
    return '';
  }

  return [
    `${prefix} Custom Params`,
    ...customParams.map(param => `${prefix} ${param.label} (${param.id}) => u_param_${param.id}`),
  ].join('\n');
}

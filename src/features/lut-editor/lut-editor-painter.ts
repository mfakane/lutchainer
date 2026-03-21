import { createLutFromPainter } from '../pipeline/pipeline-model.ts';
import type { LutModel } from '../step/step-model.ts';
import type { ColorRamp2dLutData } from './lut-editor-model.ts';
import { sampleColorRamp2d } from './lut-editor-runtime.ts';

// Generate a LutModel from a ColorRamp2dLutData.
// The resulting LutModel's id is set to uid('lut') by createLutFromPainter.
// Callers that need to preserve the original LUT id should replace it: { ...lut, id: originalId }
export function createLutFromColorRamp2d(data: ColorRamp2dLutData): LutModel {
  const lut = createLutFromPainter(data.name, (u, v) => {
    const [r, g, b] = sampleColorRamp2d(data, u, v);
    return [r, g, b];
  });
  return { ...lut, ramp2dData: data };
}

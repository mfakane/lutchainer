export class StepPreviewRenderer {
  static create(): StepPreviewRenderer | null {
    return new StepPreviewRenderer();
  }

  setLutTextures(sources: readonly TexImageSource[]): string | null {
    return null;
  }

  compileProgram(fragmentSource: string) {
    return { success: true, errors: [] };
  }

  drawToCanvas(canvas: HTMLCanvasElement, options: any): string | null {
    return null;
  }

  drawToSize(width: number, height: number, options: any): string | null {
    return null;
  }

  getInternalCanvas(): HTMLCanvasElement {
    return document.createElement('canvas');
  }
}

export function createStepPreviewSystem(options: any) {
  return {
    bumpPipelineVersion: () => {},
    ensureStepPreviewProgram: () => false,
    drawSpherePreview: () => {},
    renderPreviewPngBytes: async () => new Uint8Array(),
    reportError: () => {},
    setForceCpu: (v: unknown) => ({ ok: true, forceCpu: false, message: '' }),
    isForceCpu: () => false,
  };
}

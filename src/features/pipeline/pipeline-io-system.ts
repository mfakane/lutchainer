export function createPipelineIoSystem(options: any) {
  return {
    savePipelineAsFile: async () => ({ ok: true }),
    loadPipelineFromFile: async (f: File) => ({ ok: true, loaded: { nextStepId: 1, luts: [], steps: [] } }),
  };
}

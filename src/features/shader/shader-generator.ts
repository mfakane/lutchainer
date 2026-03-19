export const DEFAULT_VERT = `precision mediump float; void main() { gl_Position = vec4(0.0); }`;

export function buildFragmentShader(input: any) { return DEFAULT_VERT; }
export function buildHlslShader(input: any) { return ''; }
export function buildStepPreviewFragmentShader(input: any) { return DEFAULT_VERT; }
export function getShaderSource(stage: string, input: any) { return DEFAULT_VERT; }

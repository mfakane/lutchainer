import { applyLutTextures } from './lut-texture-utils.ts';
import type { Color, CustomParamModel } from '../../features/step/step-model.ts';

export interface StepPreviewShaderError {
  type: 'vertex' | 'fragment' | 'link' | 'input';
  message: string;
}

export interface StepPreviewCompileResult {
  success: boolean;
  errors: StepPreviewShaderError[];
}

export interface StepPreviewDrawOptions {
  targetStepIndex: number;
  baseColor: Color;
  lightIntensity: number;
  lightColor: Color;
  ambientColor: Color;
  specularStrength: number;
  specularPower: number;
  fresnelStrength: number;
  fresnelPower: number;
  lightDirection: readonly [number, number, number];
  customParams: readonly CustomParamModel[];
}

export interface CreateStepPreviewRendererOptions {
  canvas: HTMLCanvasElement;
  gl?: WebGLRenderingContext | null;
}

const STEP_PREVIEW_VERTEX_SHADER = `precision mediump float;

attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

interface ProgramBindings {
  positionAttr: number;
  resolution: WebGLUniformLocation | null;
  targetStep: WebGLUniformLocation | null;
  baseColor: WebGLUniformLocation | null;
  lightIntensity: WebGLUniformLocation | null;
  lightColor: WebGLUniformLocation | null;
  ambientColor: WebGLUniformLocation | null;
  specularStrength: WebGLUniformLocation | null;
  specularPower: WebGLUniformLocation | null;
  fresnelStrength: WebGLUniformLocation | null;
  fresnelPower: WebGLUniformLocation | null;
  lightDirection: WebGLUniformLocation | null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function safePositiveNumber(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}

export class StepPreviewRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGLRenderingContext;
  private readonly maxTextureUnits: number;

  private quadBuffer: WebGLBuffer | null = null;
  private program: WebGLProgram | null = null;
  private bindings: ProgramBindings | null = null;
  private lutTextures: WebGLTexture[] = [];

  constructor(canvas: HTMLCanvasElement, gl: WebGLRenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
    this.maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) as number;

    this.quadBuffer = gl.createBuffer();
    if (this.quadBuffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
          -1, -1,
           1, -1,
          -1,  1,
           1,  1,
        ]),
        gl.STATIC_DRAW,
      );
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
  }

  setLutTextures(sources: readonly TexImageSource[]): string | null {
    const result = applyLutTextures({
      gl: this.gl,
      currentTextures: this.lutTextures,
      sources,
      maxTextureUnits: this.maxTextureUnits,
    });

    if (result.shouldUpdateTextures) {
      this.lutTextures = result.textures;
    }

    return result.error;
  }

  compileProgram(fragmentSource: string): StepPreviewCompileResult {
    if (typeof fragmentSource !== 'string' || fragmentSource.trim().length === 0) {
      return {
        success: false,
        errors: [{ type: 'input', message: 'フラグメントシェーダー文字列が空です。' }],
      };
    }

    const gl = this.gl;
    const errors: StepPreviewShaderError[] = [];

    const compileShader = (type: number, source: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) {
        errors.push({
          type: type === gl.VERTEX_SHADER ? 'vertex' : 'fragment',
          message: 'シェーダーオブジェクトの作成に失敗しました。',
        });
        return null;
      }

      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        errors.push({
          type: type === gl.VERTEX_SHADER ? 'vertex' : 'fragment',
          message: gl.getShaderInfoLog(shader) ?? 'Unknown shader compile error',
        });
        gl.deleteShader(shader);
        return null;
      }

      return shader;
    };

    const vertexShader = compileShader(gl.VERTEX_SHADER, STEP_PREVIEW_VERTEX_SHADER);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) {
      if (vertexShader) gl.deleteShader(vertexShader);
      if (fragmentShader) gl.deleteShader(fragmentShader);
      return { success: false, errors };
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return {
        success: false,
        errors: [{ type: 'link', message: 'プログラムオブジェクトの作成に失敗しました。' }],
      };
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) ?? 'Unknown program link error';
      gl.deleteProgram(program);
      return {
        success: false,
        errors: [{ type: 'link', message }],
      };
    }

    if (this.program) {
      gl.deleteProgram(this.program);
    }

    this.program = program;
    this.bindings = {
      positionAttr: gl.getAttribLocation(program, 'a_position'),
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      targetStep: gl.getUniformLocation(program, 'u_targetStep'),
      baseColor: gl.getUniformLocation(program, 'u_materialBaseColor'),
      lightIntensity: gl.getUniformLocation(program, 'u_lightIntensity'),
      lightColor: gl.getUniformLocation(program, 'u_lightColor'),
      ambientColor: gl.getUniformLocation(program, 'u_ambientColor'),
      specularStrength: gl.getUniformLocation(program, 'u_specularStrength'),
      specularPower: gl.getUniformLocation(program, 'u_specularPower'),
      fresnelStrength: gl.getUniformLocation(program, 'u_fresnelStrength'),
      fresnelPower: gl.getUniformLocation(program, 'u_fresnelPower'),
      lightDirection: gl.getUniformLocation(program, 'u_previewLightDir'),
    };

    return { success: true, errors: [] };
  }

  private _renderGl(pixelWidth: number, pixelHeight: number, options: StepPreviewDrawOptions): string | null {
    if (!this.program || !this.bindings || !this.quadBuffer) {
      return 'Step プレビュー用シェーダーが初期化されていません。';
    }

    if (this.bindings.positionAttr < 0) {
      return 'Step プレビューの頂点属性 a_position が見つかりません。';
    }

    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }

    const baseColor: Color = [
      clamp01(options.baseColor[0]),
      clamp01(options.baseColor[1]),
      clamp01(options.baseColor[2]),
    ];

    const lightColor: Color = [
      clamp01(options.lightColor[0]),
      clamp01(options.lightColor[1]),
      clamp01(options.lightColor[2]),
    ];

    const ambientColor: Color = [
      clamp01(options.ambientColor[0]),
      clamp01(options.ambientColor[1]),
      clamp01(options.ambientColor[2]),
    ];

    const specularStrength = Math.max(0.0, Number.isFinite(options.specularStrength) ? options.specularStrength : 0.0);
    const specularPower = Math.max(1.0, safePositiveNumber(options.specularPower, 1.0));
    const fresnelStrength = Math.max(0.0, Number.isFinite(options.fresnelStrength) ? options.fresnelStrength : 0.0);
    const fresnelPower = Math.max(0.01, safePositiveNumber(options.fresnelPower, 0.01));
    const lightIntensity = Math.max(0.0, Math.min(2.0, Number.isFinite(options.lightIntensity) ? options.lightIntensity : 1.0));

    let lx = Number.isFinite(options.lightDirection[0]) ? options.lightDirection[0] : 0;
    let ly = Number.isFinite(options.lightDirection[1]) ? options.lightDirection[1] : 0.7071067812;
    let lz = Number.isFinite(options.lightDirection[2]) ? options.lightDirection[2] : 0.7071067812;
    const lightLength = Math.hypot(lx, ly, lz);
    if (lightLength < 1e-6) {
      lx = 0;
      ly = 0.7071067812;
      lz = 0.7071067812;
    } else {
      lx /= lightLength;
      ly /= lightLength;
      lz /= lightLength;
    }

    const gl = this.gl;
    gl.viewport(0, 0, pixelWidth, pixelHeight);
    gl.useProgram(this.program);

    if (this.bindings.resolution) {
      gl.uniform2f(this.bindings.resolution, pixelWidth, pixelHeight);
    }
    if (this.bindings.targetStep) {
      gl.uniform1i(this.bindings.targetStep, options.targetStepIndex);
    }
    if (this.bindings.baseColor) {
      gl.uniform3f(this.bindings.baseColor, baseColor[0], baseColor[1], baseColor[2]);
    }
    if (this.bindings.lightIntensity) {
      gl.uniform1f(this.bindings.lightIntensity, lightIntensity);
    }
    if (this.bindings.lightColor) {
      gl.uniform3f(this.bindings.lightColor, lightColor[0], lightColor[1], lightColor[2]);
    }
    if (this.bindings.ambientColor) {
      gl.uniform3f(this.bindings.ambientColor, ambientColor[0], ambientColor[1], ambientColor[2]);
    }
    if (this.bindings.specularStrength) {
      gl.uniform1f(this.bindings.specularStrength, specularStrength);
    }
    if (this.bindings.specularPower) {
      gl.uniform1f(this.bindings.specularPower, specularPower);
    }
    if (this.bindings.fresnelStrength) {
      gl.uniform1f(this.bindings.fresnelStrength, fresnelStrength);
    }
    if (this.bindings.fresnelPower) {
      gl.uniform1f(this.bindings.fresnelPower, fresnelPower);
    }
    if (this.bindings.lightDirection) {
      gl.uniform3f(this.bindings.lightDirection, lx, ly, lz);
    }
    for (const customParam of options.customParams) {
      const customUniform = gl.getUniformLocation(this.program, `u_param_${customParam.id}`);
      if (customUniform) {
        gl.uniform1f(customUniform, clamp01(customParam.defaultValue));
      }
    }

    for (let i = 0; i < this.lutTextures.length; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.lutTextures[i]);
      const sampler = gl.getUniformLocation(this.program, `u_lut${i}`);
      if (sampler) {
        gl.uniform1i(sampler, i);
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(this.bindings.positionAttr);
    gl.vertexAttribPointer(this.bindings.positionAttr, 2, gl.FLOAT, false, 0, 0);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.flush();

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return null;
  }

  drawToCanvas(targetCanvas: HTMLCanvasElement, options: StepPreviewDrawOptions, outputScale: number = 1): string | null {
    if (!(targetCanvas instanceof HTMLCanvasElement)) {
      return '描画先キャンバスが不正です。';
    }

    if (!Number.isInteger(options.targetStepIndex) || options.targetStepIndex < 0) {
      return `不正な targetStepIndex です: ${options.targetStepIndex}`;
    }

    const cssWidth = targetCanvas.clientWidth;
    const cssHeight = targetCanvas.clientHeight;
    if (!Number.isFinite(cssWidth) || !Number.isFinite(cssHeight) || cssWidth <= 0 || cssHeight <= 0) {
      return null;
    }

    const dpr = safePositiveNumber(outputScale, 1);
    const pixelWidth = Math.max(1, Math.round(cssWidth * dpr));
    const pixelHeight = Math.max(1, Math.round(cssHeight * dpr));

    if (targetCanvas.width !== pixelWidth || targetCanvas.height !== pixelHeight) {
      targetCanvas.width = pixelWidth;
      targetCanvas.height = pixelHeight;
    }

    const outputCtx = targetCanvas.getContext('2d');
    if (!outputCtx) {
      return 'Step プレビューキャンバスの2Dコンテキスト取得に失敗しました。';
    }

    const renderError = this._renderGl(pixelWidth, pixelHeight, options);
    if (renderError) {
      return renderError;
    }

    outputCtx.clearRect(0, 0, pixelWidth, pixelHeight);
    outputCtx.drawImage(this.canvas, 0, 0, pixelWidth, pixelHeight);
    return null;
  }

  drawToSize(pixelWidth: number, pixelHeight: number, options: StepPreviewDrawOptions): string | null {
    if (!Number.isInteger(pixelWidth) || pixelWidth <= 0 || !Number.isInteger(pixelHeight) || pixelHeight <= 0) {
      return '不正なピクセルサイズです。';
    }

    if (!Number.isInteger(options.targetStepIndex) || options.targetStepIndex < 0) {
      return `不正な targetStepIndex です: ${options.targetStepIndex}`;
    }

    return this._renderGl(pixelWidth, pixelHeight, options);
  }

  getInternalCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}

export function createStepPreviewRenderer(
  options: CreateStepPreviewRendererOptions,
): StepPreviewRenderer | null {
  if (!options || typeof options !== 'object') {
    throw new Error('Step preview renderer options must be an object.');
  }
  if (!(options.canvas instanceof HTMLCanvasElement)) {
    throw new Error('Step preview renderer canvas is invalid.');
  }

  const gl = options.gl ?? options.canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    depth: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) {
    return null;
  }

  return new StepPreviewRenderer(options.canvas, gl);
}

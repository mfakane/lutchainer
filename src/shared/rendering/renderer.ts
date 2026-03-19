import type { Geometry } from '../utils/geometry';
import type { Mat3, Mat4 } from '../utils/math';
import { applyLutTextures } from './lut-texture-utils';

export interface ShaderError {
  type: 'vertex' | 'fragment' | 'link';
  message: string;
}

export interface CompileResult {
  success: boolean;
  errors: ShaderError[];
}

interface BufferedGeometry {
  positionBuf: WebGLBuffer;
  normalBuf: WebGLBuffer;
  texcoordBuf: WebGLBuffer;
  indexBuf: WebGLBuffer;
  indexCount: number;
}

export interface MaterialUniformValues {
  baseColor: readonly [number, number, number];
  ambientColor: readonly [number, number, number];
  specularStrength: number;
  specularPower: number;
  fresnelStrength: number;
  fresnelPower: number;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram | null = null;
  private bufferedGeo: BufferedGeometry | null = null;
  private lutTextures: WebGLTexture[] = [];
  private lightLineProgram: WebGLProgram | null = null;
  private lightLineBuf: WebGLBuffer | null = null;
  private readonly maxTextureUnits: number;
  readonly startTime = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl');
    if (!gl) throw new Error('WebGL がサポートされていません');
    this.gl = gl;
    this.maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) as number;
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }

  setLutTextures(sources: TexImageSource[]): string | null {
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

  compileProgram(vertSrc: string, fragSrc: string): CompileResult {
    const gl = this.gl;
    const errors: ShaderError[] = [];

    const compileShader = (type: number, src: string): WebGLShader | null => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const msg = gl.getShaderInfoLog(shader) ?? 'Unknown error';
        errors.push({ type: type === gl.VERTEX_SHADER ? 'vertex' : 'fragment', message: msg });
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vert = compileShader(gl.VERTEX_SHADER, vertSrc);
    const frag = compileShader(gl.FRAGMENT_SHADER, fragSrc);
    if (!vert || !frag) {
      if (vert) gl.deleteShader(vert);
      if (frag) gl.deleteShader(frag);
      return { success: false, errors };
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    gl.deleteShader(vert);
    gl.deleteShader(frag);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const msg = gl.getProgramInfoLog(program) ?? 'Link error';
      errors.push({ type: 'link', message: msg });
      gl.deleteProgram(program);
      return { success: false, errors };
    }

    if (this.program) gl.deleteProgram(this.program);
    this.program = program;
    return { success: true, errors: [] };
  }

  uploadGeometry(geo: Geometry): void {
    const gl = this.gl;
    if (this.bufferedGeo) {
      gl.deleteBuffer(this.bufferedGeo.positionBuf);
      gl.deleteBuffer(this.bufferedGeo.normalBuf);
      gl.deleteBuffer(this.bufferedGeo.texcoordBuf);
      gl.deleteBuffer(this.bufferedGeo.indexBuf);
    }

    const makeBuffer = (data: Float32Array | Uint16Array, target: number): WebGLBuffer => {
      const buf = gl.createBuffer()!;
      gl.bindBuffer(target, buf);
      gl.bufferData(target, data, gl.STATIC_DRAW);
      return buf;
    };

    this.bufferedGeo = {
      positionBuf: makeBuffer(geo.positions, gl.ARRAY_BUFFER),
      normalBuf:   makeBuffer(geo.normals,   gl.ARRAY_BUFFER),
      texcoordBuf: makeBuffer(geo.texcoords, gl.ARRAY_BUFFER),
      indexBuf:    makeBuffer(geo.indices,   gl.ELEMENT_ARRAY_BUFFER),
      indexCount:  geo.indices.length,
    };
  }

  draw(
    modelMatrix: Mat4,
    viewMatrix: Mat4,
    projMatrix: Mat4,
    normalMat: Mat3,
    cameraPos: readonly [number, number, number] = [0, 0, 3],
    lightDir: readonly [number, number, number] = [0.38, 0.72, 0.4],
    showLightGuide = true,
    materialUniforms: MaterialUniformValues,
  ): void {
    const gl = this.gl;
    const { program, bufferedGeo: geo } = this;
    if (!program || !geo) return;

    gl.useProgram(program);

    const uni1f = (name: string, v: number) => {
      const loc = gl.getUniformLocation(program, name);
      if (loc !== null) gl.uniform1f(loc, v);
    };
    const uni2f = (name: string, x: number, y: number) => {
      const loc = gl.getUniformLocation(program, name);
      if (loc !== null) gl.uniform2f(loc, x, y);
    };
    const uni3f = (name: string, x: number, y: number, z: number) => {
      const loc = gl.getUniformLocation(program, name);
      if (loc !== null) gl.uniform3f(loc, x, y, z);
    };
    const uni1i = (name: string, v: number) => {
      const loc = gl.getUniformLocation(program, name);
      if (loc !== null) gl.uniform1i(loc, v);
    };
    const uniM4 = (name: string, m: Mat4) => {
      const loc = gl.getUniformLocation(program, name);
      if (loc !== null) gl.uniformMatrix4fv(loc, false, m);
    };
    const uniM3 = (name: string, m: Mat3) => {
      const loc = gl.getUniformLocation(program, name);
      if (loc !== null) gl.uniformMatrix3fv(loc, false, m);
    };

    uni1f('u_time', (performance.now() - this.startTime) / 1000);
    uni2f('u_resolution', gl.drawingBufferWidth, gl.drawingBufferHeight);
    uni3f('u_cameraPos', cameraPos[0], cameraPos[1], cameraPos[2]);
    uni3f('u_lightDir', lightDir[0], lightDir[1], lightDir[2]);
    uni3f(
      'u_materialBaseColor',
      Number.isFinite(materialUniforms.baseColor[0]) ? materialUniforms.baseColor[0] : 0,
      Number.isFinite(materialUniforms.baseColor[1]) ? materialUniforms.baseColor[1] : 0,
      Number.isFinite(materialUniforms.baseColor[2]) ? materialUniforms.baseColor[2] : 0,
    );
    uni3f(
      'u_ambientColor',
      Number.isFinite(materialUniforms.ambientColor[0]) ? materialUniforms.ambientColor[0] : 0,
      Number.isFinite(materialUniforms.ambientColor[1]) ? materialUniforms.ambientColor[1] : 0,
      Number.isFinite(materialUniforms.ambientColor[2]) ? materialUniforms.ambientColor[2] : 0,
    );
    uni1f('u_specularStrength', Number.isFinite(materialUniforms.specularStrength) ? materialUniforms.specularStrength : 0);
    uni1f('u_specularPower', Number.isFinite(materialUniforms.specularPower) ? materialUniforms.specularPower : 1);
    uni1f('u_fresnelStrength', Number.isFinite(materialUniforms.fresnelStrength) ? materialUniforms.fresnelStrength : 0);
    uni1f('u_fresnelPower', Number.isFinite(materialUniforms.fresnelPower) ? materialUniforms.fresnelPower : 0.01);
    uniM4('u_modelMatrix', modelMatrix);
    uniM4('u_viewMatrix', viewMatrix);
    uniM4('u_projectionMatrix', projMatrix);
    uniM3('u_normalMatrix', normalMat);

    this.lutTextures.forEach((texture, index) => {
      gl.activeTexture(gl.TEXTURE0 + index);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      uni1i(`u_lut${index}`, index);
    });

    const bindAttr = (name: string, buf: WebGLBuffer, size: number) => {
      const loc = gl.getAttribLocation(program, name);
      if (loc < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };

    bindAttr('a_position', geo.positionBuf, 3);
    bindAttr('a_normal',   geo.normalBuf,   3);
    bindAttr('a_texcoord', geo.texcoordBuf, 2);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.indexBuf);
    gl.drawElements(gl.TRIANGLES, geo.indexCount, gl.UNSIGNED_SHORT, 0);

    if (showLightGuide) {
      this.drawLightDirectionLine(modelMatrix, viewMatrix, projMatrix, lightDir);
    }
  }

  private getLightLineProgram(): WebGLProgram | null {
    if (this.lightLineProgram) {
      return this.lightLineProgram;
    }

    const gl = this.gl;
    const vertSrc = `precision mediump float;

attribute vec3 a_position;

uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;

void main() {
  gl_Position = u_projectionMatrix * u_viewMatrix * u_modelMatrix * vec4(a_position, 1.0);
}`;

    const fragSrc = `precision mediump float;

uniform vec4 u_color;

void main() {
  gl_FragColor = u_color;
}`;

    const compileShader = (type: number, src: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;

      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vert = compileShader(gl.VERTEX_SHADER, vertSrc);
    const frag = compileShader(gl.FRAGMENT_SHADER, fragSrc);
    if (!vert || !frag) {
      if (vert) gl.deleteShader(vert);
      if (frag) gl.deleteShader(frag);
      return null;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      return null;
    }

    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    gl.deleteShader(vert);
    gl.deleteShader(frag);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }

    this.lightLineProgram = program;
    return program;
  }

  private drawLightDirectionLine(
    modelMatrix: Mat4,
    viewMatrix: Mat4,
    projMatrix: Mat4,
    lightDir: readonly [number, number, number],
  ): void {
    const gl = this.gl;
    const program = this.getLightLineProgram();
    if (!program) return;

    if (!this.lightLineBuf) {
      this.lightLineBuf = gl.createBuffer();
      if (!this.lightLineBuf) return;
    }

    const rawX = lightDir[0];
    const rawY = lightDir[1];
    const rawZ = lightDir[2];
    if (!Number.isFinite(rawX) || !Number.isFinite(rawY) || !Number.isFinite(rawZ)) {
      return;
    }

    const len = Math.hypot(rawX, rawY, rawZ);
    if (len < 1e-6) return;

    const lineLen = 1.35;
    const x = (rawX / len) * lineLen;
    const y = (rawY / len) * lineLen;
    const z = (rawZ / len) * lineLen;

    const vertices = new Float32Array([0, 0, 0, x, y, z]);

    gl.useProgram(program);

    const posLoc = gl.getAttribLocation(program, 'a_position');
    if (posLoc < 0) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.lightLineBuf);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

    const setMat4 = (name: string, matrix: Mat4) => {
      const loc = gl.getUniformLocation(program, name);
      if (loc !== null) gl.uniformMatrix4fv(loc, false, matrix);
    };
    const setColor = (r: number, g: number, b: number, a: number) => {
      const loc = gl.getUniformLocation(program, 'u_color');
      if (loc !== null) gl.uniform4f(loc, r, g, b, a);
    };

    setMat4('u_modelMatrix', modelMatrix);
    setMat4('u_viewMatrix', viewMatrix);
    setMat4('u_projectionMatrix', projMatrix);

    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);

    gl.depthFunc(gl.LEQUAL);
    setColor(1.0, 0.91, 0.66, 0.95);
    gl.drawArrays(gl.LINES, 0, 2);

    gl.depthFunc(gl.GREATER);
    setColor(1.0, 0.91, 0.66, 0.30);
    gl.drawArrays(gl.LINES, 0, 2);

    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
  }

  clear(r = 0.08, g = 0.08, b = 0.08): void {
    const gl = this.gl;
    gl.clearColor(r, g, b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  resize(w: number, h: number): void {
    this.gl.viewport(0, 0, w, h);
  }
}

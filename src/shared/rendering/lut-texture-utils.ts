export interface ApplyLutTexturesOptions {
  gl: WebGLRenderingContext;
  currentTextures: readonly WebGLTexture[];
  sources: unknown;
  maxTextureUnits: number;
}

export type ApplyLutTexturesResult =
  | {
      shouldUpdateTextures: false;
      error: string;
    }
  | {
      shouldUpdateTextures: true;
      textures: WebGLTexture[];
      error: string | null;
    };

function isWebGlRenderingContextLike(value: unknown): value is WebGLRenderingContext {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<WebGLRenderingContext>;
  return typeof candidate.createTexture === 'function'
    && typeof candidate.deleteTexture === 'function'
    && typeof candidate.bindTexture === 'function'
    && typeof candidate.texParameteri === 'function'
    && typeof candidate.texImage2D === 'function'
    && typeof candidate.pixelStorei === 'function';
}

function isValidTextureUnitCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function resolveOptionsError(options: ApplyLutTexturesOptions): string | null {
  if (!options || typeof options !== 'object') {
    return 'LUT テクスチャ設定の入力が不正です。';
  }

  if (!isWebGlRenderingContextLike(options.gl)) {
    return 'LUT テクスチャ設定の入力が不正です。';
  }

  if (!Array.isArray(options.currentTextures)) {
    return 'LUT テクスチャ設定の入力が不正です。';
  }

  if (!isValidTextureUnitCount(options.maxTextureUnits)) {
    return 'LUT テクスチャ設定の入力が不正です。';
  }

  return null;
}

export function applyLutTextures(options: ApplyLutTexturesOptions): ApplyLutTexturesResult {
  const optionsError = resolveOptionsError(options);
  if (optionsError) {
    return {
      shouldUpdateTextures: false,
      error: optionsError,
    };
  }

  const { gl, currentTextures, sources, maxTextureUnits } = options;
  if (!Array.isArray(sources)) {
    return {
      shouldUpdateTextures: false,
      error: 'LUT の入力が不正です。',
    };
  }

  if (sources.length > maxTextureUnits) {
    return {
      shouldUpdateTextures: false,
      error: `LUT 数が多すぎます (${sources.length})。この環境の上限は ${maxTextureUnits} です。`,
    };
  }

  for (const texture of currentTextures) {
    gl.deleteTexture(texture);
  }

  const nextTextures: WebGLTexture[] = [];
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);

  for (const source of sources) {
    const texture = gl.createTexture();
    if (!texture) {
      for (const createdTexture of nextTextures) {
        gl.deleteTexture(createdTexture);
      }

      return {
        shouldUpdateTextures: true,
        textures: [],
        error: 'LUT テクスチャの作成に失敗しました。',
      };
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    nextTextures.push(texture);
  }

  gl.bindTexture(gl.TEXTURE_2D, null);
  return {
    shouldUpdateTextures: true,
    textures: nextTextures,
    error: null,
  };
}

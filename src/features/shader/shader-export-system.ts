import { strToU8, zipSync } from 'fflate';
import { listShaderGenerators, type ShaderBuildInput } from './shader-generator.ts';

export interface ExportShaderZipResult {
  ok: boolean;
  errorMessage?: string;
}

interface ShaderExportSystemOptions {
  getShaderBuildInput: () => ShaderBuildInput;
  toErrorMessage: (error: unknown) => string;
}

interface ShaderExportSystem {
  exportShaderZip: () => Promise<ExportShaderZipResult>;
}

const SHADER_EXPORT_DOWNLOAD_BASENAME = 'lutchainer-shader';

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} must be a function.`);
  }
}

function ensureOptions(options: unknown): asserts options is ShaderExportSystemOptions {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('Shader export system options must be an object.');
  }

  const candidate = options as Partial<ShaderExportSystemOptions>;
  ensureFunction(candidate.getShaderBuildInput, 'Shader export system options.getShaderBuildInput');
  ensureFunction(candidate.toErrorMessage, 'Shader export system options.toErrorMessage');
}

function normalizeErrorMessage(toErrorMessage: (error: unknown) => string, error: unknown): string {
  try {
    const message = toErrorMessage(error);
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  } catch {
    // no-op
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Unknown error.';
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function buildShaderExportDownloadFilename(now: Date = new Date()): string {
  const yyyy = String(now.getFullYear());
  const mm = pad2(now.getMonth() + 1);
  const dd = pad2(now.getDate());
  const hh = pad2(now.getHours());
  const min = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());
  return `${SHADER_EXPORT_DOWNLOAD_BASENAME}-${yyyy}${mm}${dd}-${hh}${min}${ss}.zip`;
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('PNG conversion failed.'));
        return;
      }

      blob.arrayBuffer()
        .then(buffer => resolve(new Uint8Array(buffer)))
        .catch(reject);
    }, 'image/png');
  });
}

export async function serializeShaderExportAsZip(input: ShaderBuildInput): Promise<Uint8Array> {
  const zipFiles: Record<string, Uint8Array> = {};
  for (const generator of listShaderGenerators()) {
    const files = generator.getExportFiles(input);
    for (const [path, source] of Object.entries(files)) {
      zipFiles[path] = strToU8(source);
    }
  }

  for (const lut of input.luts) {
    zipFiles[`${lut.id}.png`] = await canvasToPngBytes(lut.image);
  }

  return zipSync(zipFiles);
}

export function createShaderExportSystem(options: ShaderExportSystemOptions): ShaderExportSystem {
  ensureOptions(options);

  const exportShaderZip = async (): Promise<ExportShaderZipResult> => {
    try {
      const zipData = await serializeShaderExportAsZip(options.getShaderBuildInput());
      if (!(zipData instanceof Uint8Array) || zipData.byteLength === 0) {
        return {
          ok: false,
          errorMessage: 'Shader export archive generation failed.',
        };
      }

      const blob = new Blob(
        [(zipData.buffer as ArrayBuffer).slice(zipData.byteOffset, zipData.byteOffset + zipData.byteLength)],
        { type: 'application/zip' },
      );
      const downloadUrl = URL.createObjectURL(blob);

      try {
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.download = buildShaderExportDownloadFilename();
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        URL.revokeObjectURL(downloadUrl);
      }

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        errorMessage: normalizeErrorMessage(options.toErrorMessage, error),
      };
    }
  };

  return {
    exportShaderZip,
  };
}

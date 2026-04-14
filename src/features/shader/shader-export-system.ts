import { strToU8, zipSync } from 'fflate';
import { getShaderGenerator, type ShaderBuildInput, type ShaderLanguage } from './shader-generator.ts';

export interface ExportShaderZipResult {
  ok: boolean;
  errorMessage?: string;
}

interface ShaderExportSystemOptions {
  getShaderBuildInput: () => ShaderBuildInput;
  onDownloadZip: (zipData: Uint8Array, filename: string) => void | Promise<void>;
  toErrorMessage: (error: unknown) => string;
}

interface ShaderExportSystem {
  exportShaderZip: (language: ShaderLanguage) => Promise<ExportShaderZipResult>;
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
  ensureFunction(candidate.onDownloadZip, 'Shader export system options.onDownloadZip');
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

function buildShaderExportLanguageLabel(language: ShaderLanguage): string {
  return getShaderGenerator(language).displayName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

export function buildShaderExportDownloadFilename(language: ShaderLanguage, now: Date = new Date()): string {
  const yyyy = String(now.getFullYear());
  const mm = pad2(now.getMonth() + 1);
  const dd = pad2(now.getDate());
  const hh = pad2(now.getHours());
  const min = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());
  const languageLabel = buildShaderExportLanguageLabel(language);
  return `${SHADER_EXPORT_DOWNLOAD_BASENAME}-${languageLabel}-${yyyy}${mm}${dd}-${hh}${min}${ss}.zip`;
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

export async function serializeShaderExportAsZip(
  input: ShaderBuildInput,
  language: ShaderLanguage,
): Promise<Uint8Array> {
  const zipFiles: Record<string, Uint8Array> = {};

  const files = getShaderGenerator(language).getExportFiles(input);
  for (const [path, source] of Object.entries(files)) {
    zipFiles[path] = strToU8(source);
  }

  for (const lut of input.luts) {
    zipFiles[`${lut.id}.png`] = await canvasToPngBytes(lut.image);
  }

  return zipSync(zipFiles);
}

export function createShaderExportSystem(options: ShaderExportSystemOptions): ShaderExportSystem {
  ensureOptions(options);

  const exportShaderZip = async (language: ShaderLanguage): Promise<ExportShaderZipResult> => {
    try {
      const zipData = await serializeShaderExportAsZip(options.getShaderBuildInput(), language);
      if (!(zipData instanceof Uint8Array) || zipData.byteLength === 0) {
        return {
          ok: false,
          errorMessage: 'Shader export archive generation failed.',
        };
      }

      await options.onDownloadZip(zipData, buildShaderExportDownloadFilename(language));

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

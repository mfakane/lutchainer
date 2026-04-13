import {
    MAX_PIPELINE_IMAGE_SIDE,
    type PipelineImageAdapter,
} from '../../features/pipeline/pipeline-model.ts';
import {
    type ColorWithAlpha,
    type LutModel,
} from '../../features/step/step-model.ts';
import type { PipelineZipLutEntry } from '../../shared/lutchain/lutchain-archive.ts';

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function hasFiniteColor(value: ColorWithAlpha): boolean {
  return Array.isArray(value)
    && value.length >= 3
    && Number.isFinite(value[0])
    && Number.isFinite(value[1])
    && Number.isFinite(value[2])
    && (value[3] === undefined || Number.isFinite(value[3]));
}

function createLutFromCanvas(name: string, srcCanvas: HTMLCanvasElement, idPrefix: string): LutModel {
  if (!(srcCanvas instanceof HTMLCanvasElement)) {
    throw new Error('LUT 元画像が不正です。');
  }
  if (srcCanvas.width < 2 || srcCanvas.height < 2) {
    throw new Error('LUT 画像サイズが小さすぎます。2x2以上の画像を指定してください。');
  }

  const canvas = document.createElement('canvas');
  canvas.width = srcCanvas.width;
  canvas.height = srcCanvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('LUT キャンバス化に失敗しました。');
  }

  ctx.drawImage(srcCanvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  return {
    id: uid(idPrefix),
    name,
    image: canvas,
    width: canvas.width,
    height: canvas.height,
    pixels: imageData.data,
    thumbUrl: canvas.toDataURL('image/png'),
  };
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`画像読み込みに失敗しました: ${file.name}`));
    };
    img.src = url;
  });
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('PNG変換に失敗しました。'));
        return;
      }

      blob.arrayBuffer()
        .then(ab => resolve(new Uint8Array(ab)))
        .catch(reject);
    }, 'image/png');
  });
}

async function createLutFromZipPngBytes(
  entry: PipelineZipLutEntry,
  pngBytes: Uint8Array,
): Promise<LutModel> {
  const blob = new Blob(
    [(pngBytes.buffer as ArrayBuffer).slice(pngBytes.byteOffset, pngBytes.byteOffset + pngBytes.byteLength)],
    { type: 'image/png' },
  );
  const url = URL.createObjectURL(blob);

  let img: HTMLImageElement;
  try {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`LUT「${entry.name}」の画像読み込みに失敗しました。`));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }

  if (img.width < 2 || img.height < 2) {
    throw new Error(`LUT「${entry.name}」の画像サイズが小さすぎます。2x2以上が必要です。`);
  }
  if (img.width > MAX_PIPELINE_IMAGE_SIDE || img.height > MAX_PIPELINE_IMAGE_SIDE) {
    throw new Error(`LUT「${entry.name}」の画像サイズが大きすぎます。最大 ${MAX_PIPELINE_IMAGE_SIDE}px です。`);
  }
  if (img.width !== entry.width || img.height !== entry.height) {
    throw new Error(`LUT「${entry.name}」の画像サイズがmanifestの情報と一致しません。`);
  }

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error(`LUT「${entry.name}」のキャンバス生成に失敗しました。`);
  }

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  return {
    id: entry.id,
    name: entry.name,
    image: canvas,
    width: canvas.width,
    height: canvas.height,
    pixels: imageData.data,
    thumbUrl: canvas.toDataURL('image/png'),
    ...(entry.ramp2dData !== undefined ? { ramp2dData: entry.ramp2dData } : {}),
  };
}

export function createBrowserPipelineImageAdapter(): PipelineImageAdapter {
  return {
    createLutFromPainter: (name, painter) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('LUT キャンバスのコンテキスト取得に失敗しました。');
      }

      const imageData = ctx.createImageData(canvas.width, canvas.height);
      const data = imageData.data;
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const u = x / (canvas.width - 1);
          const v = y / (canvas.height - 1);
          const c = painter(u, v);
          if (!hasFiniteColor(c)) {
            throw new Error('LUT painter が不正な色を返しました。');
          }
          const idx = (y * canvas.width + x) * 4;
          data[idx + 0] = Math.round(clamp01(c[0]) * 255);
          data[idx + 1] = Math.round(clamp01(c[1]) * 255);
          data[idx + 2] = Math.round(clamp01(c[2]) * 255);
          data[idx + 3] = Math.round(clamp01(c[3] ?? 1) * 255);
        }
      }

      ctx.putImageData(imageData, 0, 0);

      return {
        id: uid('lut'),
        name,
        image: canvas,
        width: canvas.width,
        height: canvas.height,
        pixels: imageData.data,
        thumbUrl: canvas.toDataURL('image/png'),
      };
    },
    createLutFromFile: async file => {
      const img = await loadImageFromFile(file);
      const maxSide = 512;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const width = Math.max(2, Math.round(img.width * scale));
      const height = Math.max(2, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error(`LUT変換に失敗しました: ${file.name}`);
      }
      ctx.drawImage(img, 0, 0, width, height);

      return createLutFromCanvas(file.name, canvas, 'lut-file');
    },
    canvasToPngBytes,
    createLutFromZipPngBytes,
  };
}

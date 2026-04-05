function formatDatePart(value: number, digits: number): string {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error('日付情報が不正です。');
  }
  return String(value).padStart(digits, '0');
}

export function buildPreviewDownloadFilename(kind: 'main' | 'step', now: Date = new Date()): string {
  if (kind !== 'main' && kind !== 'step') {
    throw new Error(`kind が不正です: ${String(kind)}`);
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error('保存時刻の取得に失敗しました。');
  }

  const yyyy = formatDatePart(now.getFullYear(), 4);
  const mm = formatDatePart(now.getMonth() + 1, 2);
  const dd = formatDatePart(now.getDate(), 2);
  const hh = formatDatePart(now.getHours(), 2);
  const min = formatDatePart(now.getMinutes(), 2);
  const ss = formatDatePart(now.getSeconds(), 2);
  const suffix = kind === 'main' ? '3d-preview' : 'step-preview';
  return `lutchainer-preview-${suffix}-${yyyy}${mm}${dd}-${hh}${min}${ss}.png`;
}

export function downloadBlobAsFile(blob: Blob, filename: string): void {
  if (!(blob instanceof Blob) || blob.size <= 0) {
    throw new Error('ダウンロード対象のBlobが不正です。');
  }
  if (typeof filename !== 'string' || filename.trim().length === 0) {
    throw new Error('ダウンロードファイル名が不正です。');
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  if (!(canvas instanceof HTMLCanvasElement)) {
    return Promise.reject(new Error('キャンバス要素が不正です。'));
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('PNGの生成に失敗しました。'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

export function copyCanvasSnapshot(canvas: HTMLCanvasElement): HTMLCanvasElement {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('スナップショット元キャンバスが不正です。');
  }
  if (!Number.isInteger(canvas.width) || !Number.isInteger(canvas.height) || canvas.width <= 0 || canvas.height <= 0) {
    throw new Error('スナップショット元キャンバスのサイズが不正です。');
  }

  const snapshot = document.createElement('canvas');
  snapshot.width = canvas.width;
  snapshot.height = canvas.height;

  const ctx = snapshot.getContext('2d');
  if (!ctx) {
    throw new Error('スナップショット用Canvasの作成に失敗しました。');
  }

  ctx.drawImage(canvas, 0, 0);
  return snapshot;
}

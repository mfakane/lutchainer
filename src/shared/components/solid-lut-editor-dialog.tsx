import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { createLutFromColorRamp2d } from '../../features/lut-editor/lut-editor-painter.ts';
import {
  MAX_RAMPS,
  MAX_STOPS_PER_RAMP,
  MIN_RAMPS,
  MIN_STOPS_PER_RAMP,
  type ColorRamp,
  type ColorRamp2dLutData,
  type ColorStop,
} from '../../features/lut-editor/lut-editor-model.ts';
import {
  addRamp,
  addStop,
  colorToHex,
  moveRamp,
  moveStop,
  parseHexColor,
  removeRamp,
  removeStop,
  reorderRamps,
  renderColorRamp2dToPixels,
  updateRamp,
  updateStopAlpha,
  updateStopColor,
} from '../../features/lut-editor/lut-editor-runtime.ts';
import type { LutModel } from '../../features/step/step-model.ts';
import { t, useLanguage } from '../i18n.ts';

type StatusKind = 'success' | 'error' | 'info';

// Pixels the pointer must travel perpendicular to a rail to trigger delete
const DRAG_DELETE_THRESHOLD = 36;

// --- Types ---

interface LutEditorDialogContentOptions {
  onApply: (lutId: string | null, updatedLut: LutModel) => void;
  onClose: () => void;
  onStatus: (message: string, kind?: StatusKind) => void;
}

interface LutEditorDialogShellOptions {
  dialogEl: HTMLDialogElement;
  surfaceEl: Element;
  onApply: (lutId: string | null, updatedLut: LutModel) => void;
  onStatus: (message: string, kind?: StatusKind) => void;
}

// --- Module-level state ---

let syncLutEditorDialogInternal: ((data: ColorRamp2dLutData | null, lutId: string | null) => void) | null = null;
let disposeLutEditorDialogContent: (() => void) | null = null;
let disposeLutEditorDialogShell: (() => void) | null = null;

// --- Validation ---

function ensureLutEditorDialogShellOptions(value: unknown): asserts value is LutEditorDialogShellOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('mountLutEditorDialogShell: options must be an object');
  }
  const options = value as Partial<LutEditorDialogShellOptions>;
  if (!(options.dialogEl instanceof HTMLDialogElement)) {
    throw new Error('mountLutEditorDialogShell: dialogEl must be an HTMLDialogElement');
  }
  if (!(options.surfaceEl instanceof Element)) {
    throw new Error('mountLutEditorDialogShell: surfaceEl must be a DOM Element');
  }
  if (typeof options.onApply !== 'function') {
    throw new Error('mountLutEditorDialogShell: onApply must be a function');
  }
  if (typeof options.onStatus !== 'function') {
    throw new Error('mountLutEditorDialogShell: onStatus must be a function');
  }
}

// --- Component ---

function LutEditorDialogContent(props: { options: LutEditorDialogContentOptions }) {
  const language = useLanguage();
  const tr = (key: string, values?: Record<string, string | number>): string => {
    language();
    return t(key, values);
  };

  const [rampData, setRampData] = createSignal<ColorRamp2dLutData | null>(null);
  const [editingLutId, setEditingLutId] = createSignal<string | null>(null);
  const [selectedRampId, setSelectedRampId] = createSignal<string | null>(null);
  const [focusedStopId, setFocusedStopId] = createSignal<string | null>(null);

  // Pending-delete state during drag (shows visual indicator on the knob)
  const [draggingRampDeleteId, setDraggingRampDeleteId] = createSignal<string | null>(null);
  const [draggingStopDeleteId, setDraggingStopDeleteId] = createSignal<string | null>(null);

  // Ramp list D&D reorder state
  const [draggingRampListIdx, setDraggingRampListIdx] = createSignal<number | null>(null);
  const [rampListDropIdx, setRampListDropIdx] = createSignal<number | null>(null);
  const rampRowElMap = new Map<string, HTMLElement>();

  syncLutEditorDialogInternal = (data, lutId) => {
    setRampData(data);
    setEditingLutId(lutId);
    const firstRamp = data?.ramps[0];
    setSelectedRampId(firstRamp?.id ?? null);
    setFocusedStopId(firstRamp?.stops[0]?.id ?? null);
  };

  const selectedRamp = createMemo((): ColorRamp | null => {
    const data = rampData();
    const id = selectedRampId();
    if (!data || !id) return null;
    return data.ramps.find(r => r.id === id) ?? null;
  });

  const focusedStop = createMemo((): ColorStop | null => {
    const ramp = selectedRamp();
    const id = focusedStopId();
    if (!ramp || !id) return null;
    return ramp.stops.find(s => s.id === id) ?? null;
  });

  // Reset focused stop when selected ramp changes and the stop no longer exists
  createEffect(() => {
    const ramp = selectedRamp();
    const fid = focusedStopId();
    if (!ramp) { setFocusedStopId(null); return; }
    if (!fid || !ramp.stops.some(s => s.id === fid)) {
      setFocusedStopId(ramp.stops[0]?.id ?? null);
    }
  });

  // Canvas / strip refs
  let previewCanvasRef: HTMLCanvasElement | undefined;
  let rampKnobStripRef: HTMLDivElement | undefined;
  let stopKnobStripRef: HTMLDivElement | undefined;
  let stopPreviewBarRef: HTMLDivElement | undefined;

  // Mutable ref to gate onClick after a ramp-list drag
  let rampListDragOccurredRef = false;

  // Compute above/below placement for preview-bar stop knobs to avoid overlap.
  // Knobs default to "below". If a knob would be within OVERLAP_THRESHOLD pixels
  // of the previous "below" knob, it is moved "above" instead.
  const OVERLAP_THRESHOLD_PX = 14;
  const stopKnobPlacements = createMemo((): Map<string, 'below' | 'above'> => {
    const ramp = selectedRamp();
    const placements = new Map<string, 'below' | 'above'>();
    if (!ramp) return placements;

    const rawWidth = stopPreviewBarRef?.getBoundingClientRect().width ?? 0;
    const barWidth = rawWidth > 0 ? rawWidth : 256;
    const threshold = OVERLAP_THRESHOLD_PX / barWidth;

    const sorted = [...ramp.stops].sort((a, b) => a.position - b.position);
    let lastBelowPos = -Infinity;
    let lastAbovePos = -Infinity;

    for (const stop of sorted) {
      const belowClear = stop.position - lastBelowPos >= threshold;
      const aboveClear = stop.position - lastAbovePos >= threshold;
      if (belowClear) {
        placements.set(stop.id, 'below');
        lastBelowPos = stop.position;
      } else if (aboveClear) {
        placements.set(stop.id, 'above');
        lastAbovePos = stop.position;
      } else {
        // Both lanes occupied — force below (best effort)
        placements.set(stop.id, 'below');
        lastBelowPos = stop.position;
      }
    }
    return placements;
  });

  // Canvas redraw
  const redrawPreview = (): void => {
    const data = rampData();
    const canvas = previewCanvasRef;
    if (!data || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixels = renderColorRamp2dToPixels(data);
    const imageData = ctx.createImageData(data.width, data.height);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);

    // Draw selected ramp indicator line
    const selRamp = selectedRamp();
    if (selRamp) {
      const y = Math.round(selRamp.yPosition * (data.height - 1));
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(data.width, y + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw focused stop indicator line
    const stop = focusedStop();
    if (stop) {
      const x = Math.round(stop.position * (data.width - 1));
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, data.height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  createEffect(() => {
    rampData();
    selectedRampId();
    focusedStopId();
    redrawPreview();
  });

  // --- Boundary checks ---

  const isRampBoundary = (rampId: string): boolean => {
    const data = rampData();
    if (!data) return false;
    const idx = data.ramps.findIndex(r => r.id === rampId);
    return idx === 0 || idx === data.ramps.length - 1;
  };

  const isStopBoundary = (stopId: string): boolean => {
    const ramp = selectedRamp();
    if (!ramp) return false;
    const idx = ramp.stops.findIndex(s => s.id === stopId);
    return idx === 0 || idx === ramp.stops.length - 1;
  };

  // --- Ramp operations ---

  const handleRemoveRamp = (rampId: string): void => {
    const data = rampData();
    if (!data) return;
    const newData = removeRamp(data, rampId);
    setRampData(newData);
    if (selectedRampId() === rampId) {
      setSelectedRampId(newData.ramps[0]?.id ?? null);
    }
  };

  const handleAddRampAtY = (y: number): void => {
    const data = rampData();
    if (!data || data.ramps.length >= MAX_RAMPS) return;
    const newData = addRamp(data, y);
    setRampData(newData);
    const addedRamp = newData.ramps.find(r => !data.ramps.some(old => old.id === r.id));
    if (addedRamp) setSelectedRampId(addedRamp.id);
  };

  const handleAddRamp = (): void => {
    const data = rampData();
    if (!data || data.ramps.length >= MAX_RAMPS) return;
    // Insert at the midpoint of the largest gap
    const ramps = data.ramps;
    let bestGap = 0;
    let bestY = 0.5;
    for (let i = 0; i < ramps.length - 1; i++) {
      const gap = ramps[i + 1]!.yPosition - ramps[i]!.yPosition;
      if (gap > bestGap) {
        bestGap = gap;
        bestY = (ramps[i]!.yPosition + ramps[i + 1]!.yPosition) / 2;
      }
    }
    handleAddRampAtY(bestY);
  };

  // --- Stop operations ---

  const handleRemoveStop = (stopId: string): void => {
    const data = rampData();
    const ramp = selectedRamp();
    if (!data || !ramp) return;
    const newRamp = removeStop(ramp, stopId);
    const newData = updateRamp(data, newRamp);
    setRampData(newData);
    if (focusedStopId() === stopId) {
      setFocusedStopId(newRamp.stops[0]?.id ?? null);
    }
  };

  const handleAddStopAtPos = (pos: number): void => {
    const data = rampData();
    const ramp = selectedRamp();
    if (!data || !ramp || ramp.stops.length >= MAX_STOPS_PER_RAMP) return;
    const newRamp = addStop(ramp, pos);
    const newData = updateRamp(data, newRamp);
    setRampData(newData);
    const addedStop = newRamp.stops.find(s => !ramp.stops.some(old => old.id === s.id));
    if (addedStop) setFocusedStopId(addedStop.id);
  };

  const handleAddStop = (): void => {
    const ramp = selectedRamp();
    if (!ramp) return;
    // Insert at midpoint of largest gap
    const stops = ramp.stops;
    let bestGap = 0;
    let bestPos = 0.5;
    for (let i = 0; i < stops.length - 1; i++) {
      const gap = stops[i + 1]!.position - stops[i]!.position;
      if (gap > bestGap) {
        bestGap = gap;
        bestPos = (stops[i]!.position + stops[i + 1]!.position) / 2;
      }
    }
    handleAddStopAtPos(bestPos);
  };

  const handleStopColorChange = (stopId: string, hexValue: string): void => {
    const data = rampData();
    const ramp = selectedRamp();
    if (!data || !ramp) return;
    const color = parseHexColor(hexValue);
    const newRamp = updateStopColor(ramp, stopId, color);
    setRampData(updateRamp(data, newRamp));
  };

  const handleStopAlphaChange = (stopId: string, value: string): void => {
    const data = rampData();
    const ramp = selectedRamp();
    if (!data || !ramp) return;
    const alpha = Number(value) / 100;
    const newRamp = updateStopAlpha(ramp, stopId, alpha);
    setRampData(updateRamp(data, newRamp));
  };

  const handleStopPositionChange = (stopId: string, percentValue: string): void => {
    const data = rampData();
    const ramp = selectedRamp();
    if (!data || !ramp) return;
    const parsed = Number(percentValue);
    if (!Number.isFinite(parsed)) return;
    const newRamp = moveStop(ramp, stopId, parsed / 100);
    setRampData(updateRamp(data, newRamp));
  };

  // --- Drag: ramp knobs (vertical rail on right edge of canvas) ---
  // Drag left past threshold → pending delete; release → delete

  const startRampDrag = (rampId: string, ev: PointerEvent): void => {
    ev.preventDefault();
    let pendingDelete = false;

    const onMove = (e: PointerEvent): void => {
      const strip = rampKnobStripRef;
      if (!strip) return;
      const rect = strip.getBoundingClientRect();
      const newY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      // Distance dragged to the LEFT of the strip's left edge → delete gesture
      const horizDist = e.clientX - rect.right;
      const nowDelete = horizDist > DRAG_DELETE_THRESHOLD;
      pendingDelete = nowDelete;
      setDraggingRampDeleteId(nowDelete ? rampId : null);
      if (!nowDelete) {
        const data = rampData();
        if (data) setRampData(moveRamp(data, rampId, newY));
      }
    };

    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      setDraggingRampDeleteId(null);
      if (pendingDelete) handleRemoveRamp(rampId);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  // --- Drag: stop knobs (horizontal rail on bottom edge of canvas) ---
  // Drag up/down past threshold → pending delete; release → delete

  const startStopDrag = (stopId: string, ev: PointerEvent): void => {
    ev.preventDefault();
    let pendingDelete = false;

    const onMove = (e: PointerEvent): void => {
      const strip = stopKnobStripRef;
      if (!strip) return;
      const rect = strip.getBoundingClientRect();
      const newPos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      // Distance dragged BELOW the strip's bottom edge → delete gesture
      const vertDistBelow = e.clientY - rect.bottom;
      const nowDelete = vertDistBelow > DRAG_DELETE_THRESHOLD;
      pendingDelete = nowDelete;
      setDraggingStopDeleteId(nowDelete ? stopId : null);
      if (!nowDelete) {
        const data = rampData();
        const ramp = selectedRamp();
        if (data && ramp) {
          const newRamp = moveStop(ramp, stopId, newPos);
          setRampData(updateRamp(data, newRamp));
        }
      }
    };

    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      setDraggingStopDeleteId(null);
      if (pendingDelete) handleRemoveStop(stopId);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  // --- Drag: preview bar stop knobs (move only, no delete) ---

  const startPreviewStopDrag = (stopId: string, ev: PointerEvent): void => {
    ev.preventDefault();
    const onMove = (e: PointerEvent): void => {
      const bar = stopPreviewBarRef;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const newPos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const data = rampData();
      const ramp = selectedRamp();
      if (data && ramp) {
        const newRamp = moveStop(ramp, stopId, newPos);
        setRampData(updateRamp(data, newRamp));
      }
    };
    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  // --- Rail click handlers: click on empty strip area to add ---

  const handleRampStripPointerDown = (ev: PointerEvent): void => {
    const strip = rampKnobStripRef;
    // Only fire when clicking the strip itself, not a child knob
    if (!strip || ev.target !== strip) return;
    const rect = strip.getBoundingClientRect();
    const y = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
    handleAddRampAtY(y);
  };

  const handleStopStripPointerDown = (ev: PointerEvent): void => {
    const strip = stopKnobStripRef;
    if (!strip || ev.target !== strip) return;
    const rect = strip.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
    handleAddStopAtPos(x);
  };

  // --- Canvas click: select nearest ramp by Y ---

  const handleCanvasClick = (ev: MouseEvent): void => {
    const data = rampData();
    const canvas = previewCanvasRef;
    if (!data || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const relX = (ev.clientX - rect.left) / rect.width;
    const relY = (ev.clientY - rect.top) / rect.height;

    // Find nearest ramp by Y
    let nearestRamp: ColorRamp | null = null;
    let bestRampDist = Infinity;
    for (const ramp of data.ramps) {
      const dist = Math.abs(ramp.yPosition - relY);
      if (dist < bestRampDist) { bestRampDist = dist; nearestRamp = ramp; }
    }
    if (!nearestRamp) return;
    setSelectedRampId(nearestRamp.id);

    // Find nearest stop by X within that ramp
    let nearestStop: ColorStop | null = null;
    let bestStopDist = Infinity;
    for (const stop of nearestRamp.stops) {
      const dist = Math.abs(stop.position - relX);
      if (dist < bestStopDist) { bestStopDist = dist; nearestStop = stop; }
    }
    if (nearestStop) setFocusedStopId(nearestStop.id);
  };

  // --- Ramp list DnD reorder ---

  const startRampListDrag = (rampIdx: number, ev: PointerEvent): void => {
    const startX = ev.clientX;
    const startY = ev.clientY;
    const MOVE_THRESHOLD = 4;
    let dragStarted = false;
    rampListDragOccurredRef = false;

    const onMove = (e: PointerEvent): void => {
      if (!dragStarted) {
        if (Math.abs(e.clientX - startX) < MOVE_THRESHOLD && Math.abs(e.clientY - startY) < MOVE_THRESHOLD) return;
        dragStarted = true;
        rampListDragOccurredRef = true;
        e.preventDefault();
        setDraggingRampListIdx(rampIdx);
        setRampListDropIdx(null);
      }

      const data = rampData();
      if (!data) return;
      const n = data.ramps.length;
      // Determine insertBeforeIndex from pointer Y vs each row's midpoint
      let dropIdx = 0;
      for (let i = 0; i < n; i++) {
        const ramp = data.ramps[i]!;
        const el = rampRowElMap.get(ramp.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          dropIdx = i;
          break;
        }
        dropIdx = i + 1;
      }
      setRampListDropIdx(dropIdx);
    };

    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      if (dragStarted) {
        const dropIdx = rampListDropIdx();
        if (dropIdx !== null) {
          const data = rampData();
          if (data) {
            const newData = reorderRamps(data, rampIdx, dropIdx);
            if (newData !== data) setRampData(newData);
          }
        }
        setDraggingRampListIdx(null);
        setRampListDropIdx(null);
      }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  // Returns true when a drop indicator should appear before list item at `idx`
  const showDropBefore = (idx: number): boolean => {
    const dragIdx = draggingRampListIdx();
    const dropIdx = rampListDropIdx();
    if (dragIdx === null || dropIdx === null) return false;
    if (dropIdx !== idx) return false;
    // Skip no-op positions (inserting immediately before or after self)
    if (idx === dragIdx || idx === dragIdx + 1) return false;
    return true;
  };

  // Returns true when a drop indicator should appear after the last list item
  const showDropAfterLast = (): boolean => {
    const data = rampData();
    const dragIdx = draggingRampListIdx();
    const dropIdx = rampListDropIdx();
    if (!data || dragIdx === null || dropIdx === null) return false;
    const n = data.ramps.length;
    if (dropIdx !== n) return false;
    // Skip no-op: dragging the last item after itself
    if (dragIdx === n - 1) return false;
    return true;
  };

  // --- Apply ---

  const handleApply = (): void => {
    const data = rampData();
    if (!data) return;
    const lutId = editingLutId();
    const newLut = createLutFromColorRamp2d(data);
    props.options.onApply(lutId, newLut);
    props.options.onClose();
  };

  // --- Style helpers ---

  const rampSwatchStyle = (ramp: ColorRamp): string => {
    const stops = ramp.stops.map(s => `${colorToHex(s.color)} ${Math.round(s.position * 100)}%`);
    return `background: linear-gradient(to right, ${stops.join(', ')})`;
  };

  const canRemoveRamp = (rampId: string): boolean => {
    const data = rampData();
    if (!data || data.ramps.length <= MIN_RAMPS) return false;
    const idx = data.ramps.findIndex(r => r.id === rampId);
    return idx > 0 && idx < data.ramps.length - 1;
  };

  const rampKnobClass = (ramp: ColorRamp): string => {
    const parts = ['lut-editor-ramp-knob'];
    if (selectedRampId() === ramp.id) parts.push('selected');
    if (isRampBoundary(ramp.id)) parts.push('boundary');
    if (draggingRampDeleteId() === ramp.id) parts.push('pending-delete');
    return parts.join(' ');
  };

  const stopKnobClass = (stop: ColorStop): string => {
    const parts = ['lut-editor-stop-knob'];
    if (focusedStopId() === stop.id) parts.push('focused');
    if (isStopBoundary(stop.id)) parts.push('boundary');
    if (draggingStopDeleteId() === stop.id) parts.push('pending-delete');
    return parts.join(' ');
  };

  const previewStopKnobClass = (stop: ColorStop): string => {
    const placement = stopKnobPlacements().get(stop.id) ?? 'below';
    const parts = ['lut-editor-preview-stop-knob', placement];
    if (focusedStopId() === stop.id) parts.push('focused');
    if (isStopBoundary(stop.id)) parts.push('boundary');
    return parts.join(' ');
  };

  return (
    <>
      <div class="lut-editor-head">
        <div class="lut-editor-title" id="lut-editor-dialog-title">{tr('lutEditor.title')}</div>
        <div class="lut-editor-head-actions">
          <button type="button" class="btn-primary" onClick={handleApply} disabled={!rampData()}>
            {tr('lutEditor.apply')}
          </button>
          <button type="button" class="btn-secondary" onClick={props.options.onClose}>
            {tr('lutEditor.cancel')}
          </button>
        </div>
      </div>

      <div class="lut-editor-body">
        {/* Left: canvas + knob rails */}
        <div class="lut-editor-preview-col">
          <div class="lut-editor-canvas-area">
            {/* Main 2D preview canvas */}
            <div class="lut-editor-canvas-wrap" onClick={handleCanvasClick}>
              <canvas
                ref={el => { previewCanvasRef = el; }}
                class="lut-editor-canvas"
                width={rampData()?.width ?? 256}
                height={rampData()?.height ?? 256}
              />
            </div>

            {/* Right rail: ramp Y-position knobs.
                Click on empty area → add ramp.
                Drag knob left past threshold → delete ramp. */}
            <div
              class="lut-editor-ramp-knob-strip"
              ref={el => { rampKnobStripRef = el; }}
              title={tr('lutEditor.rampRailHint')}
              onPointerDown={(ev: PointerEvent) => handleRampStripPointerDown(ev)}
            >
              <For each={rampData()?.ramps ?? []}>
                {ramp => (
                  <div
                    class={rampKnobClass(ramp)}
                    style={{ top: `${ramp.yPosition * 100}%` }}
                    onPointerDown={ev => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      setSelectedRampId(ramp.id);
                      if (!isRampBoundary(ramp.id)) startRampDrag(ramp.id, ev);
                    }}
                  />
                )}
              </For>
            </div>

            {/* Bottom rail: stop X-position knobs for the selected ramp.
                Click on empty area → add stop.
                Drag knob up past threshold → delete stop. */}
            <div
              class="lut-editor-stop-knob-strip"
              ref={el => { stopKnobStripRef = el; }}
              title={tr('lutEditor.stopRailHint')}
              onPointerDown={(ev: PointerEvent) => handleStopStripPointerDown(ev)}
            >
              <For each={selectedRamp()?.stops ?? []}>
                {stop => (
                  <div
                    class={stopKnobClass(stop)}
                    style={{
                      left: `${stop.position * 100}%`,
                      'background-color': colorToHex(stop.color),
                    }}
                    onPointerDown={ev => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      setFocusedStopId(stop.id);
                      if (!isStopBoundary(stop.id)) startStopDrag(stop.id, ev);
                    }}
                  />
                )}
              </For>
            </div>
          </div>

          {/* Axis labels */}
          <div class="lut-editor-canvas-labels">
            <span class="lut-editor-canvas-label-u">U →</span>
            <span class="lut-editor-canvas-label-v">V ↓</span>
          </div>
        </div>

        {/* Right: ramp list + focused stop editor */}
        <div class="lut-editor-right-col">
          {/* Ramp list */}
          <div class="lut-editor-ramp-section">
            <div class="lut-editor-section-header">
              <div class="lut-editor-section-label">{tr('lutEditor.rampListLabel')}</div>
              <button
                type="button"
                class="btn-secondary lut-editor-ramp-add"
                onClick={handleAddRamp}
                disabled={!rampData() || (rampData()?.ramps.length ?? 0) >= MAX_RAMPS}
              >
                {tr('lutEditor.addRamp')}
              </button>
            </div>
            <div class="lut-editor-ramp-list">
              <For each={rampData()?.ramps ?? []}>
                {(ramp, getIdx) => (
                  <>
                    <Show when={showDropBefore(getIdx())}>
                      <div class="lut-editor-ramp-drop-indicator" />
                    </Show>
                    <div
                      class={`lut-editor-ramp-row${selectedRampId() === ramp.id ? ' selected' : ''}${draggingRampListIdx() === getIdx() ? ' dragging' : ''}`}
                      ref={el => { rampRowElMap.set(ramp.id, el); }}
                      onPointerDown={ev => startRampListDrag(getIdx(), ev)}
                      onClick={() => { if (!rampListDragOccurredRef) setSelectedRampId(ramp.id); }}
                    >
                      <div class="lut-editor-ramp-swatch" style={rampSwatchStyle(ramp)} />
                      <span class="lut-editor-ramp-y">
                        {tr('lutEditor.yPosition')}: {(ramp.yPosition * 100).toFixed(0)}%
                      </span>
                      <Show when={canRemoveRamp(ramp.id)}>
                        <button
                          type="button"
                          class="btn-ghost lut-editor-ramp-remove"
                          onClick={ev => {
                            ev.stopPropagation();
                            handleRemoveRamp(ramp.id);
                          }}
                        >
                          {tr('lutEditor.removeRamp')}
                        </button>
                      </Show>
                    </div>
                  </>
                )}
              </For>
              <Show when={showDropAfterLast()}>
                <div class="lut-editor-ramp-drop-indicator" />
              </Show>
            </div>
          </div>

          {/* Focused stop editor */}
          <div class="lut-editor-stop-section">
            <div class="lut-editor-section-header">
              <div class="lut-editor-section-label">{tr('lutEditor.stopEditorLabel')}</div>
              <div class="lut-editor-section-header-actions">
                <button
                  type="button"
                  class="btn-secondary lut-editor-stop-add"
                  onClick={handleAddStop}
                  disabled={!selectedRamp() || (selectedRamp()?.stops.length ?? 0) >= MAX_STOPS_PER_RAMP}
                >
                  {tr('lutEditor.addStop')}
                </button>
                <Show when={focusedStop() && !isStopBoundary(focusedStop()!.id)}>
                  <button
                    type="button"
                    class="btn-ghost lut-editor-stop-remove"
                    onClick={() => { const s = focusedStop(); if (s) handleRemoveStop(s.id); }}
                  >
                    {tr('lutEditor.removeStop')}
                  </button>
                </Show>
              </div>
            </div>

            {/* Gradient preview bar + draggable stop knobs */}
            <Show when={selectedRamp()}>
              {getSelectedRamp => (
                <div class="lut-editor-stop-preview-area">
                  <div
                    class="lut-editor-stop-preview"
                    ref={el => { stopPreviewBarRef = el as HTMLDivElement; }}
                    style={rampSwatchStyle(getSelectedRamp())}
                  >
                    <For each={getSelectedRamp().stops}>
                      {stop => (
                        <div
                          class={previewStopKnobClass(stop)}
                          style={{
                            left: `${stop.position * 100}%`,
                            'background-color': colorToHex(stop.color),
                          }}
                          onPointerDown={ev => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            setFocusedStopId(stop.id);
                            if (!isStopBoundary(stop.id)) startPreviewStopDrag(stop.id, ev);
                          }}
                        />
                      )}
                    </For>
                  </div>
                </div>
              )}
            </Show>

            {/* Focused stop editor fields */}
            <Show
              when={focusedStop()}
              fallback={<div class="lut-editor-no-ramp">{tr('lutEditor.noStopSelected')}</div>}
            >
              {getStop => (
                <div class="lut-editor-stop-editor">
                  <div class="lut-editor-stop-editor-field">
                    <label class="lut-editor-stop-editor-label">{tr('lutEditor.stopColor')}</label>
                    <input
                      type="color"
                      class="lut-editor-stop-color"
                      value={colorToHex(getStop().color)}
                      onInput={ev => handleStopColorChange(getStop().id, (ev.currentTarget as HTMLInputElement).value)}
                    />
                  </div>
                  <div class="lut-editor-stop-editor-field">
                    <label class="lut-editor-stop-editor-label">{tr('lutEditor.stopPosition')}</label>
                    <input
                      type="number"
                      class="lut-editor-stop-pos-input"
                      min="0"
                      max="100"
                      step="1"
                      disabled={isStopBoundary(getStop().id)}
                      value={Math.round(getStop().position * 100)}
                      onInput={ev => handleStopPositionChange(getStop().id, (ev.currentTarget as HTMLInputElement).value)}
                    />
                    <span class="lut-editor-stop-editor-unit">%</span>
                  </div>
                  <div class="lut-editor-stop-editor-field">
                    <label class="lut-editor-stop-editor-label">{tr('lutEditor.alpha')}</label>
                    <input
                      type="range"
                      class="lut-editor-stop-alpha"
                      min="0"
                      max="100"
                      value={Math.round(getStop().alpha * 100)}
                      onInput={ev => handleStopAlphaChange(getStop().id, (ev.currentTarget as HTMLInputElement).value)}
                    />
                    <span class="lut-editor-stop-editor-unit">{Math.round(getStop().alpha * 100)}%</span>
                  </div>
                </div>
              )}
            </Show>
          </div>
        </div>
      </div>
    </>
  );
}

// --- Public API ---

export function mountLutEditorDialogContent(
  el: Element,
  options: LutEditorDialogContentOptions,
): void {
  if (!(el instanceof Element)) {
    throw new Error('mountLutEditorDialogContent: el must be a DOM Element');
  }

  if (disposeLutEditorDialogContent) {
    disposeLutEditorDialogContent();
    disposeLutEditorDialogContent = null;
  }

  syncLutEditorDialogInternal = null;
  disposeLutEditorDialogContent = render(() => <LutEditorDialogContent options={options} />, el);
}

export function mountLutEditorDialogShell(options: LutEditorDialogShellOptions): void {
  ensureLutEditorDialogShellOptions(options);

  if (disposeLutEditorDialogShell) {
    disposeLutEditorDialogShell();
    disposeLutEditorDialogShell = null;
  }

  const closeLutEditorDialog = (): void => {
    if (typeof options.dialogEl.close === 'function') {
      if (options.dialogEl.open) {
        options.dialogEl.close();
      }
      return;
    }
    options.dialogEl.removeAttribute('open');
  };

  mountLutEditorDialogContent(options.surfaceEl, {
    onApply: options.onApply,
    onClose: closeLutEditorDialog,
    onStatus: options.onStatus,
  });

  const onCancel = (event: Event) => {
    event.preventDefault();
    closeLutEditorDialog();
  };

  const onDialogClick = (event: MouseEvent) => {
    if (event.target !== options.dialogEl) return;
    const rect = options.dialogEl.getBoundingClientRect();
    const isOutside = event.clientX < rect.left || event.clientX > rect.right
      || event.clientY < rect.top || event.clientY > rect.bottom;
    if (isOutside) {
      closeLutEditorDialog();
    }
  };

  options.dialogEl.addEventListener('cancel', onCancel);
  options.dialogEl.addEventListener('click', onDialogClick);

  disposeLutEditorDialogShell = () => {
    options.dialogEl.removeEventListener('cancel', onCancel);
    options.dialogEl.removeEventListener('click', onDialogClick);
  };
}

export function syncLutEditorDialogState(
  data: ColorRamp2dLutData | null,
  lutId: string | null,
): void {
  syncLutEditorDialogInternal?.(data, lutId);
}

import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import {
  MAX_RAMPS,
  MAX_STOPS_PER_RAMP,
  MIN_RAMPS,
  type ColorRamp,
  type ColorRamp2dLutData,
  type ColorStop
} from '../../../features/lut-editor/lut-editor-model.ts';
import { createLutFromColorRamp2d } from '../../../features/lut-editor/lut-editor-painter.ts';
import {
  addRamp,
  addStop,
  moveRamp,
  moveStop,
  removeRamp,
  removeStop,
  renderColorRamp2dToPixels,
  reorderRamps,
  updateRamp,
  updateStopAlpha,
  updateStopColor,
} from '../../../features/lut-editor/lut-editor-runtime.ts';
import { colorToHex, parseHexColor, uid } from '../../../features/pipeline/pipeline-model.ts';
import type { LutModel } from '../../../features/step/step-model.ts';
import { t, useLanguage } from '../i18n.ts';
import { DropdownMenu } from './solid-dropdown-menu.tsx';

type StatusKind = 'success' | 'error' | 'info';

// Pixels the pointer must travel perpendicular to a rail to trigger delete
const DRAG_DELETE_THRESHOLD = 36;
const POSITION_PERCENT_STEP = 0.01;

// --- Types ---

interface LutEditorDialogContentOptions {
  onApply: (lutId: string | null, updatedLut: LutModel) => void;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

interface LutEditorDialogShellOptions {
  dialogEl: HTMLDialogElement;
  surfaceEl: Element;
  onApply: (lutId: string | null, updatedLut: LutModel) => void;
}

function serializeRampData(data: ColorRamp2dLutData | null): string {
  return data ? JSON.stringify(data) : '';
}

function formatPositionPercent(position: number): string {
  return (position * 100).toFixed(2);
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
  const [initialSerializedRampData, setInitialSerializedRampData] = createSignal('');
  const [editingRampPositionId, setEditingRampPositionId] = createSignal<string | null>(null);
  const [rampPositionDraft, setRampPositionDraft] = createSignal('');
  const [editingStopPositionId, setEditingStopPositionId] = createSignal<string | null>(null);
  const [stopPositionDraft, setStopPositionDraft] = createSignal('');

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
    setInitialSerializedRampData(serializeRampData(data));
    const firstRamp = data?.ramps[0];
    setSelectedRampId(firstRamp?.id ?? null);
    setFocusedStopId(firstRamp?.stops[0]?.id ?? null);
  };

  const isDirty = createMemo(() => serializeRampData(rampData()) !== initialSerializedRampData());

  createEffect(() => {
    props.options.onDirtyChange(isDirty());
  });

  createEffect(() => {
    const ramp = selectedRamp();
    if (!ramp) {
      setEditingRampPositionId(null);
      setRampPositionDraft('');
      return;
    }
    if (editingRampPositionId() !== ramp.id) {
      setRampPositionDraft(formatPositionPercent(ramp.position));
    }
  });

  createEffect(() => {
    const stop = focusedStop();
    if (!stop) {
      setEditingStopPositionId(null);
      setStopPositionDraft('');
      return;
    }
    if (editingStopPositionId() !== stop.id) {
      setStopPositionDraft(formatPositionPercent(stop.position));
    }
  });

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

    const swapped = !!data.axisSwap;

    // Draw selected ramp indicator line
    const selRamp = selectedRamp();
    if (selRamp) {
      const pos = Math.round(selRamp.position * ((swapped ? data.width : data.height) - 1));
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      if (swapped) {
        ctx.moveTo(pos + 0.5, 0);
        ctx.lineTo(pos + 0.5, data.height);
      } else {
        ctx.moveTo(0, pos + 0.5);
        ctx.lineTo(data.width, pos + 0.5);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw focused stop indicator line
    const stop = focusedStop();
    if (stop) {
      const pos = Math.round(stop.position * ((swapped ? data.height : data.width) - 1));
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      if (swapped) {
        ctx.moveTo(0, pos + 0.5);
        ctx.lineTo(data.width, pos + 0.5);
      } else {
        ctx.moveTo(pos + 0.5, 0);
        ctx.lineTo(pos + 0.5, data.height);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  // Throttle canvas redraws to one per animation frame so dragging knobs
  // (which updates rampData on every pointermove) doesn't block the main thread.
  let rafPendingId: number | null = null;
  const scheduleRedraw = (): void => {
    if (rafPendingId !== null) return;
    rafPendingId = requestAnimationFrame(() => {
      rafPendingId = null;
      redrawPreview();
    });
  };

  createEffect(() => {
    rampData();
    selectedRampId();
    focusedStopId();
    scheduleRedraw();
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
    rampRowElMap.delete(rampId);
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
      const gap = ramps[i + 1]!.position - ramps[i]!.position;
      if (gap > bestGap) {
        bestGap = gap;
        bestY = (ramps[i]!.position + ramps[i + 1]!.position) / 2;
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
    if (!color) return;
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

  const handleRampPositionChange = (rampId: string, percentValue: string): void => {
    const data = rampData();
    if (!data) return;
    setRampPositionDraft(percentValue);
    const parsed = Number(percentValue);
    if (!Number.isFinite(parsed)) return;
    setRampData(moveRamp(data, rampId, parsed / 100));
  };

  const commitRampPositionDraft = (rampId: string): void => {
    const ramp = rampData()?.ramps.find(item => item.id === rampId) ?? selectedRamp();
    const parsed = Number(rampPositionDraft());
    setEditingRampPositionId(null);
    if (!ramp || !Number.isFinite(parsed)) {
      setRampPositionDraft(ramp ? formatPositionPercent(ramp.position) : '');
      return;
    }
    const normalized = formatPositionPercent(parsed / 100);
    handleRampPositionChange(rampId, normalized);
    setRampPositionDraft(normalized);
  };

  const handleStopPositionChange = (stopId: string, percentValue: string): void => {
    const data = rampData();
    const ramp = selectedRamp();
    if (!data || !ramp) return;
    setStopPositionDraft(percentValue);
    const parsed = Number(percentValue);
    if (!Number.isFinite(parsed)) return;
    const newRamp = moveStop(ramp, stopId, parsed / 100);
    setRampData(updateRamp(data, newRamp));
  };

  const commitStopPositionDraft = (stopId: string): void => {
    const stop = focusedStop();
    const parsed = Number(stopPositionDraft());
    setEditingStopPositionId(null);
    if (!stop || stop.id !== stopId || !Number.isFinite(parsed)) {
      setStopPositionDraft(stop ? formatPositionPercent(stop.position) : '');
      return;
    }
    const normalized = formatPositionPercent(parsed / 100);
    handleStopPositionChange(stopId, normalized);
    setStopPositionDraft(normalized);
  };

  const handleRampPositionWheel = (rampId: string, currentPosition: number, ev: WheelEvent): void => {
    ev.preventDefault();
    const delta = ev.deltaY < 0 ? POSITION_PERCENT_STEP / 100 : -POSITION_PERCENT_STEP / 100;
    const newPercent = formatPositionPercent(Math.max(0, Math.min(1, currentPosition + delta)));
    handleRampPositionChange(rampId, newPercent);
  };

  const handleStopPositionWheel = (stopId: string, currentPosition: number, ev: WheelEvent): void => {
    ev.preventDefault();
    const delta = ev.deltaY < 0 ? POSITION_PERCENT_STEP / 100 : -POSITION_PERCENT_STEP / 100;
    const newPercent = formatPositionPercent(Math.max(0, Math.min(1, currentPosition + delta)));
    handleStopPositionChange(stopId, newPercent);
  };

  const handleStopAlphaWheel = (stopId: string, currentAlpha: number, ev: WheelEvent): void => {
    ev.preventDefault();
    const delta = ev.deltaY < 0 ? 0.01 : -0.01;
    const newAlpha = Math.round(Math.max(0, Math.min(1, currentAlpha + delta)) * 100);
    handleStopAlphaChange(stopId, String(newAlpha));
  };

  const getDuplicatePosition = (positions: readonly number[], index: number): number | null => {
    const current = positions[index];
    if (current === undefined) return null;

    const prevGap = index > 0 ? current - positions[index - 1]! : -1;
    const nextGap = index < positions.length - 1 ? positions[index + 1]! - current : -1;

    if (nextGap > 0 && (prevGap <= 0 || nextGap >= prevGap)) {
      return current + nextGap / 2;
    }

    if (prevGap > 0) {
      return current - prevGap / 2;
    }

    return null;
  };

  const handleDuplicateSelectedRamp = (): void => {
    const data = rampData();
    const ramp = selectedRamp();
    if (!data || !ramp || data.ramps.length >= MAX_RAMPS) return;

    const rampIndex = data.ramps.findIndex(candidate => candidate.id === ramp.id);
    if (rampIndex < 0) return;

    const duplicatePosition = getDuplicatePosition(data.ramps.map(candidate => candidate.position), rampIndex);
    if (duplicatePosition === null) return;

    const duplicatedRamp: ColorRamp = {
      id: uid('ramp'),
      position: duplicatePosition,
      stops: ramp.stops.map(stop => ({
        ...stop,
        id: uid('stop'),
      })),
    };

    const newData = {
      ...data,
      ramps: [...data.ramps, duplicatedRamp].sort((a, b) => a.position - b.position),
    };

    setRampData(newData);
    setSelectedRampId(duplicatedRamp.id);
    setFocusedStopId(duplicatedRamp.stops[0]?.id ?? null);
  };

  const handleInvertSelectedRamp = (): void => {
    const data = rampData();
    const ramp = selectedRamp();
    if (!data || !ramp) return;

    const currentSelectedRampId = ramp.id;
    const currentFocusedStopId = focusedStopId();
    const invertedRamps = [...data.ramps]
      .reverse()
      .map(candidate => ({
        ...candidate,
        position: 1 - candidate.position,
      }))
      .sort((a, b) => a.position - b.position);

    setRampData({
      ...data,
      ramps: invertedRamps,
    });
    setSelectedRampId(currentSelectedRampId);
    setFocusedStopId(currentFocusedStopId);
  };

  const handleDuplicateFocusedStop = (): void => {
    const data = rampData();
    const ramp = selectedRamp();
    const stop = focusedStop();
    if (!data || !ramp || !stop || ramp.stops.length >= MAX_STOPS_PER_RAMP) return;

    const stopIndex = ramp.stops.findIndex(candidate => candidate.id === stop.id);
    if (stopIndex < 0) return;

    const duplicatePosition = getDuplicatePosition(ramp.stops.map(candidate => candidate.position), stopIndex);
    if (duplicatePosition === null) return;

    const duplicatedStop: ColorStop = {
      ...stop,
      id: uid('stop'),
      position: duplicatePosition,
    };

    const updatedRamp: ColorRamp = {
      ...ramp,
      stops: [...ramp.stops, duplicatedStop].sort((a, b) => a.position - b.position),
    };

    setRampData(updateRamp(data, updatedRamp));
    setFocusedStopId(duplicatedStop.id);
  };

  const handleInvertFocusedStop = (): void => {
    const data = rampData();
    const ramp = selectedRamp();
    const stop = focusedStop();
    if (!data || !ramp || !stop) return;

    const updatedRamp: ColorRamp = {
      ...ramp,
      stops: [...ramp.stops]
        .reverse()
        .map(candidate => ({
          ...candidate,
          position: 1 - candidate.position,
        }))
        .sort((a, b) => a.position - b.position),
    };

    setRampData(updateRamp(data, updatedRamp));
    setFocusedStopId(stop.id);
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
      const swapped = !!rampData()?.axisSwap;
      const newY = swapped
        ? Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        : Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      // Delete gesture: drag away from canvas edge (right when on right rail, down when on bottom rail)
      const deleteDist = swapped ? e.clientY - rect.bottom : e.clientX - rect.right;
      const nowDelete = !isRampBoundary(rampId) && deleteDist > DRAG_DELETE_THRESHOLD;
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
      const swapped = !!rampData()?.axisSwap;
      const newPos = swapped
        ? Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
        : Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      // Delete gesture: drag away from canvas edge (down when on bottom rail, right when on right rail)
      const deleteDist = swapped ? e.clientX - rect.right : e.clientY - rect.bottom;
      const nowDelete = !isStopBoundary(stopId) && deleteDist > DRAG_DELETE_THRESHOLD;
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
    const swapped = !!rampData()?.axisSwap;
    const y = swapped
      ? Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
      : Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
    handleAddRampAtY(y);
  };

  const handleStopStripPointerDown = (ev: PointerEvent): void => {
    const strip = stopKnobStripRef;
    if (!strip || ev.target !== strip) return;
    const rect = strip.getBoundingClientRect();
    const swapped = !!rampData()?.axisSwap;
    const x = swapped
      ? Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height))
      : Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
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

    const swapped = !!data.axisSwap;
    const rampAxis = swapped ? relX : relY;
    const stopAxis = swapped ? relY : relX;

    // Find nearest ramp along the ramp axis
    let nearestRamp: ColorRamp | null = null;
    let bestRampDist = Infinity;
    for (const ramp of data.ramps) {
      const dist = Math.abs(ramp.position - rampAxis);
      if (dist < bestRampDist) { bestRampDist = dist; nearestRamp = ramp; }
    }
    if (!nearestRamp) return;
    setSelectedRampId(nearestRamp.id);

    // Find nearest stop along the stop axis within that ramp
    let nearestStop: ColorStop | null = null;
    let bestStopDist = Infinity;
    for (const stop of nearestRamp.stops) {
      const dist = Math.abs(stop.position - stopAxis);
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
    setInitialSerializedRampData(serializeRampData(data));
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
        <input
          id="lut-editor-dialog-title"
          type="text"
          class="lut-editor-title-input"
          value={rampData()?.name ?? ''}
          onInput={e => {
            const name = (e.target as HTMLInputElement).value;
            const data = rampData();
            if (data) setRampData({ ...data, name });
          }}
        />
        <div class="lut-editor-head-actions">
          <button type="button" class="btn btn-submit" onClick={handleApply} disabled={!rampData()}>
            {tr('lutEditor.apply')}
          </button>
          <button type="button" class="btn btn-secondary" onClick={props.options.onClose}>
            {tr('lutEditor.cancel')}
          </button>
        </div>
      </div>

      <div class="lut-editor-body">
        {/* Left: canvas + knob rails */}
        <div class="lut-editor-preview-col">
          <div class={`lut-editor-canvas-area${rampData()?.axisSwap ? ' axis-swapped' : ''}`}>
            {/* Main 2D preview canvas */}
            <div class="lut-editor-canvas-wrap checker-bg" onClick={handleCanvasClick}>
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
                    style={rampData()?.axisSwap
                      ? { left: `${ramp.position * 100}%` }
                      : { top: `${ramp.position * 100}%` }}
                    onPointerDown={ev => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      setSelectedRampId(ramp.id);
                      startRampDrag(ramp.id, ev);
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
                    style={rampData()?.axisSwap
                      ? { top: `${stop.position * 100}%`, 'background-color': colorToHex(stop.color) }
                      : { left: `${stop.position * 100}%`, 'background-color': colorToHex(stop.color) }}
                    onPointerDown={ev => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      setFocusedStopId(stop.id);
                      startStopDrag(stop.id, ev);
                    }}
                  />
                )}
              </For>
            </div>
          </div>

          {/* Axis orientation selector */}
          <div class="lut-editor-axis-options">
            <label class="lut-editor-axis-option">
              <input
                type="radio"
                name="lut-editor-axis"
                checked={!rampData()?.axisSwap}
                onChange={() => {
                  const data = rampData();
                  if (data) setRampData({ ...data, axisSwap: false });
                }}
              />
              {tr('lutEditor.axisStopXRampY')}
            </label>
            <label class="lut-editor-axis-option">
              <input
                type="radio"
                name="lut-editor-axis"
                checked={!!rampData()?.axisSwap}
                onChange={() => {
                  const data = rampData();
                  if (data) setRampData({ ...data, axisSwap: true });
                }}
              />
              {tr('lutEditor.axisRampXStopY')}
            </label>
          </div>
        </div>

        {/* Right: ramp list + focused stop editor */}
        <div class="lut-editor-right-col">
          {/* Ramp list */}
          <div class="lut-editor-ramp-section">
            <div class="lut-editor-section-header">
              <div class="lut-editor-section-label">{tr('lutEditor.rampListLabel')}</div>
              <div class="lut-editor-section-header-actions">
                <button
                  type="button"
                  class="btn btn-secondary lut-editor-ramp-add"
                  onClick={handleAddRamp}
                  disabled={!rampData() || (rampData()?.ramps.length ?? 0) >= MAX_RAMPS}
                >
                  {tr('lutEditor.addRamp')}
                </button>
                <Show when={selectedRamp()}>
                  <DropdownMenu
                    wrapperClass="menu-wrap"
                    triggerClass="btn menu-trigger"
                    menuClass="menu lut-editor-kebab-menu"
                    triggerAriaLabel={tr('lutEditor.rampMenuAria')}
                    menuRole="menu"
                  >
                    {controls => (
                      <>
                        <button
                          type="button"
                          class="btn menu-item"
                          role="menuitem"
                          disabled={(rampData()?.ramps.length ?? 0) >= MAX_RAMPS}
                          onClick={() => {
                            controls.closeMenu();
                            handleDuplicateSelectedRamp();
                          }}
                        >
                          {tr('lutEditor.duplicateRamp')}
                        </button>
                        <button
                          type="button"
                          class="btn menu-item"
                          role="menuitem"
                          onClick={() => {
                            controls.closeMenu();
                            handleInvertSelectedRamp();
                          }}
                        >
                          {tr('lutEditor.invertRamp')}
                        </button>
                      </>
                    )}
                  </DropdownMenu>
                </Show>
              </div>
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
                        {tr('lutEditor.rampPosition')}: {formatPositionPercent(ramp.position)}%
                      </span>
                      <Show when={canRemoveRamp(ramp.id)}>
                        <button
                          type="button"
                          class="btn btn-ghost lut-editor-ramp-remove"
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
            <Show when={selectedRamp()}>
              {getSelectedRamp => (
                <div class="lut-editor-ramp-position-editor">
                  <label class="lut-editor-stop-editor-label">{tr('lutEditor.rampPosition')}</label>
                  <input
                    type="number"
                    class="lut-editor-stop-pos-input"
                    min="0"
                    max="100"
                    step={String(POSITION_PERCENT_STEP)}
                    value={editingRampPositionId() === getSelectedRamp().id
                      ? rampPositionDraft()
                      : formatPositionPercent(getSelectedRamp().position)}
                    onFocus={() => {
                      setEditingRampPositionId(getSelectedRamp().id);
                      setRampPositionDraft(formatPositionPercent(getSelectedRamp().position));
                    }}
                    onInput={ev => handleRampPositionChange(getSelectedRamp().id, (ev.currentTarget as HTMLInputElement).value)}
                    onBlur={() => commitRampPositionDraft(getSelectedRamp().id)}
                    onKeyDown={ev => {
                      if (ev.key === 'Enter') {
                        (ev.currentTarget as HTMLInputElement).blur();
                      } else if (ev.key === 'Escape') {
                        setEditingRampPositionId(null);
                        setRampPositionDraft(formatPositionPercent(getSelectedRamp().position));
                        (ev.currentTarget as HTMLInputElement).blur();
                      }
                    }}
                    onWheel={ev => handleRampPositionWheel(getSelectedRamp().id, getSelectedRamp().position, ev)}
                  />
                  <span class="lut-editor-stop-editor-unit">%</span>
                </div>
              )}
            </Show>
          </div>

          {/* Focused stop editor */}
          <div class="lut-editor-stop-section">
            <div class="lut-editor-section-header">
              <div class="lut-editor-section-label">{tr('lutEditor.stopEditorLabel')}</div>
              <div class="lut-editor-section-header-actions">
                <button
                  type="button"
                  class="btn btn-secondary lut-editor-stop-add"
                  onClick={handleAddStop}
                  disabled={!selectedRamp() || (selectedRamp()?.stops.length ?? 0) >= MAX_STOPS_PER_RAMP}
                >
                  {tr('lutEditor.addStop')}
                </button>
                <Show when={focusedStop() && !isStopBoundary(focusedStop()!.id)}>
                  <button
                    type="button"
                    class="btn btn-ghost lut-editor-stop-remove"
                    onClick={() => { const s = focusedStop(); if (s) handleRemoveStop(s.id); }}
                    >
                      {tr('lutEditor.removeStop')}
                    </button>
                  </Show>
                <Show when={focusedStop()}>
                  <DropdownMenu
                    wrapperClass="menu-wrap"
                    triggerClass="btn menu-trigger"
                    menuClass="menu lut-editor-kebab-menu"
                    triggerAriaLabel={tr('lutEditor.stopMenuAria')}
                    menuRole="menu"
                  >
                    {controls => (
                      <>
                        <button
                          type="button"
                          class="btn menu-item"
                          role="menuitem"
                          disabled={(selectedRamp()?.stops.length ?? 0) >= MAX_STOPS_PER_RAMP}
                          onClick={() => {
                            controls.closeMenu();
                            handleDuplicateFocusedStop();
                          }}
                        >
                          {tr('lutEditor.duplicateStop')}
                        </button>
                        <button
                          type="button"
                          class="btn menu-item"
                          role="menuitem"
                          onClick={() => {
                            controls.closeMenu();
                            handleInvertFocusedStop();
                          }}
                        >
                          {tr('lutEditor.invertStop')}
                        </button>
                      </>
                    )}
                  </DropdownMenu>
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
                            startPreviewStopDrag(stop.id, ev);
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
                      step={String(POSITION_PERCENT_STEP)}
                      value={editingStopPositionId() === getStop().id
                        ? stopPositionDraft()
                        : formatPositionPercent(getStop().position)}
                      onFocus={() => {
                        setEditingStopPositionId(getStop().id);
                        setStopPositionDraft(formatPositionPercent(getStop().position));
                      }}
                      onInput={ev => handleStopPositionChange(getStop().id, (ev.currentTarget as HTMLInputElement).value)}
                      onBlur={() => commitStopPositionDraft(getStop().id)}
                      onKeyDown={ev => {
                        if (ev.key === 'Enter') {
                          (ev.currentTarget as HTMLInputElement).blur();
                        } else if (ev.key === 'Escape') {
                          setEditingStopPositionId(null);
                          setStopPositionDraft(formatPositionPercent(getStop().position));
                          (ev.currentTarget as HTMLInputElement).blur();
                        }
                      }}
                      onWheel={ev => handleStopPositionWheel(getStop().id, getStop().position, ev)}
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
                      onWheel={ev => handleStopAlphaWheel(getStop().id, getStop().alpha, ev)}
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
    onDirtyChange: dirty => {
      options.dialogEl.dataset.dirty = dirty ? 'true' : 'false';
    },
  });

  const onCancel = (event: Event) => {
    event.preventDefault();
    if (options.dialogEl.dataset.dirty === 'true') {
      return;
    }
    closeLutEditorDialog();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    if (!options.dialogEl.open) return;
    if (options.dialogEl.dataset.dirty !== 'true') return;
    event.preventDefault();
    event.stopPropagation();
  };

  // Clicks on the <dialog> element itself (not any child) are backdrop clicks.
  const onDialogClick = (event: MouseEvent) => {
    if (event.target !== options.dialogEl) return;
    if (options.dialogEl.dataset.dirty === 'true') {
      return;
    }
    closeLutEditorDialog();
  };

  options.dialogEl.addEventListener('cancel', onCancel);
  options.dialogEl.addEventListener('keydown', onKeyDown, true);
  options.dialogEl.addEventListener('click', onDialogClick);

  disposeLutEditorDialogShell = () => {
    options.dialogEl.removeEventListener('cancel', onCancel);
    options.dialogEl.removeEventListener('keydown', onKeyDown, true);
    options.dialogEl.removeEventListener('click', onDialogClick);
  };
}

export function syncLutEditorDialogState(
  data: ColorRamp2dLutData | null,
  lutId: string | null,
): void {
  syncLutEditorDialogInternal?.(data, lutId);
}

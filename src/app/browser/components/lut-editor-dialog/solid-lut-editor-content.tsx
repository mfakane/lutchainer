import { createEffect, createMemo, createSignal, type JSX } from 'solid-js';
import {
  MAX_RAMPS,
  MAX_STOPS_PER_RAMP,
  MIN_RAMPS,
  type ColorRamp,
  type ColorRamp2dLutData,
  type ColorStop,
} from '../../../../features/lut-editor/lut-editor-model.ts';
import { createLutFromColorRamp2d } from '../../../../features/lut-editor/lut-editor-painter.ts';
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
} from '../../../../features/lut-editor/lut-editor-runtime.ts';
import { colorToHex, parseHexColor, uid } from '../../../../features/pipeline/pipeline-model.ts';
import { t, useLanguage } from '../../i18n.ts';
import { cx } from '../../styles/cx.ts';
import * as ui from '../../styles/ui-primitives.css.ts';
import * as styles from './shared.css.ts';
import {
  DRAG_DELETE_THRESHOLD,
  formatPositionPercent,
  isValidPositionPercentDraft,
  POSITION_PERCENT_STEP,
  serializeRampData,
  type LutEditorDialogContentOptions,
} from './shared.ts';
import { LutEditorPreview } from './solid-lut-editor-preview.tsx';
import { LutEditorRampSection } from './solid-lut-editor-ramp-section.tsx';
import { LutEditorStopSection } from './solid-lut-editor-stop-section.tsx';

export interface LutEditorContentSyncApi {
  sync: (data: ColorRamp2dLutData | null, lutId: string | null) => void;
}

export function createLutEditorContentSync(): LutEditorContentSyncApi {
  return { sync: () => undefined };
}

export function LutEditorDialogContent(props: { options: LutEditorDialogContentOptions; syncApi: LutEditorContentSyncApi }): JSX.Element {
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
  const [draggingRampDeleteId, setDraggingRampDeleteId] = createSignal<string | null>(null);
  const [draggingStopDeleteId, setDraggingStopDeleteId] = createSignal<string | null>(null);
  const [draggingRampListIdx, setDraggingRampListIdx] = createSignal<number | null>(null);
  const [rampListDropIdx, setRampListDropIdx] = createSignal<number | null>(null);
  const rampRowElMap = new Map<string, HTMLElement>();

  let previewCanvasRef: HTMLCanvasElement | undefined;
  let rampKnobStripRef: HTMLDivElement | undefined;
  let stopKnobStripRef: HTMLDivElement | undefined;
  let stopPreviewBarRef: HTMLDivElement | undefined;
  let rampPositionInputRef: HTMLInputElement | undefined;
  let stopPositionInputRef: HTMLInputElement | undefined;
  let rampListDragOccurredRef = false;

  props.syncApi.sync = (data, lutId) => {
    setRampData(data);
    setEditingLutId(lutId);
    setInitialSerializedRampData(serializeRampData(data));
    const firstRamp = data?.ramps[0];
    setSelectedRampId(firstRamp?.id ?? null);
    setFocusedStopId(firstRamp?.stops[0]?.id ?? null);
  };

  const selectedRamp = createMemo((): ColorRamp | null => {
    const data = rampData();
    const id = selectedRampId();
    if (!data || !id) return null;
    return data.ramps.find(ramp => ramp.id === id) ?? null;
  });

  const focusedStop = createMemo((): ColorStop | null => {
    const ramp = selectedRamp();
    const id = focusedStopId();
    if (!ramp || !id) return null;
    return ramp.stops.find(stop => stop.id === id) ?? null;
  });

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

  createEffect(() => {
    const ramp = selectedRamp();
    const focusedId = focusedStopId();
    if (!ramp) {
      setFocusedStopId(null);
      return;
    }
    if (!focusedId || !ramp.stops.some(stop => stop.id === focusedId)) {
      setFocusedStopId(ramp.stops[0]?.id ?? null);
    }
  });

  const stopKnobPlacements = createMemo((): Map<string, 'below' | 'above'> => {
    const ramp = selectedRamp();
    const placements = new Map<string, 'below' | 'above'>();
    if (!ramp) return placements;

    const rawWidth = stopPreviewBarRef?.getBoundingClientRect().width ?? 0;
    const barWidth = rawWidth > 0 ? rawWidth : 256;
    const threshold = 14 / barWidth;
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
        placements.set(stop.id, 'below');
        lastBelowPos = stop.position;
      }
    }

    return placements;
  });

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
    const selected = selectedRamp();
    if (selected) {
      const pos = Math.round(selected.position * ((swapped ? data.width : data.height) - 1));
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

  const isRampBoundary = (rampId: string): boolean => {
    const data = rampData();
    if (!data) return false;
    const idx = data.ramps.findIndex(ramp => ramp.id === rampId);
    return idx === 0 || idx === data.ramps.length - 1;
  };

  const isStopBoundary = (stopId: string): boolean => {
    const ramp = selectedRamp();
    if (!ramp) return false;
    const idx = ramp.stops.findIndex(stop => stop.id === stopId);
    return idx === 0 || idx === ramp.stops.length - 1;
  };

  const handleRemoveRamp = (rampId: string): void => {
    const data = rampData();
    if (!data) return;
    const nextData = removeRamp(data, rampId);
    setRampData(nextData);
    rampRowElMap.delete(rampId);
    if (selectedRampId() === rampId) {
      setSelectedRampId(nextData.ramps[0]?.id ?? null);
    }
  };

  const handleAddRampAtY = (y: number): void => {
    const data = rampData();
    if (!data || data.ramps.length >= MAX_RAMPS) return;
    const nextData = addRamp(data, y);
    setRampData(nextData);
    const addedRamp = nextData.ramps.find(ramp => !data.ramps.some(old => old.id === ramp.id));
    if (addedRamp) setSelectedRampId(addedRamp.id);
  };

  const handleAddRamp = (): void => {
    const data = rampData();
    if (!data || data.ramps.length >= MAX_RAMPS) return;
    let bestGap = 0;
    let bestY = 0.5;
    for (let index = 0; index < data.ramps.length - 1; index += 1) {
      const gap = data.ramps[index + 1]!.position - data.ramps[index]!.position;
      if (gap > bestGap) {
        bestGap = gap;
        bestY = (data.ramps[index]!.position + data.ramps[index + 1]!.position) / 2;
      }
    }
    handleAddRampAtY(bestY);
  };

  const handleRemoveStop = (stopId: string): void => {
    const data = rampData();
    const ramp = selectedRamp();
    if (!data || !ramp) return;
    const nextRamp = removeStop(ramp, stopId);
    setRampData(updateRamp(data, nextRamp));
    if (focusedStopId() === stopId) setFocusedStopId(nextRamp.stops[0]?.id ?? null);
  };

  const handleAddStopAtPos = (pos: number): void => {
    const data = rampData();
    const ramp = selectedRamp();
    if (!data || !ramp || ramp.stops.length >= MAX_STOPS_PER_RAMP) return;
    const nextRamp = addStop(ramp, pos);
    setRampData(updateRamp(data, nextRamp));
    const addedStop = nextRamp.stops.find(stop => !ramp.stops.some(old => old.id === stop.id));
    if (addedStop) setFocusedStopId(addedStop.id);
  };

  const handleAddStop = (): void => {
    const ramp = selectedRamp();
    if (!ramp) return;
    let bestGap = 0;
    let bestPos = 0.5;
    for (let index = 0; index < ramp.stops.length - 1; index += 1) {
      const gap = ramp.stops[index + 1]!.position - ramp.stops[index]!.position;
      if (gap > bestGap) {
        bestGap = gap;
        bestPos = (ramp.stops[index]!.position + ramp.stops[index + 1]!.position) / 2;
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
    setRampData(updateRamp(data, updateStopColor(ramp, stopId, color)));
  };

  const handleStopAlphaChange = (stopId: string, value: string): void => {
    const data = rampData();
    const ramp = selectedRamp();
    if (!data || !ramp) return;
    setRampData(updateRamp(data, updateStopAlpha(ramp, stopId, Number(value) / 100)));
  };

  const handleRampPositionChange = (rampId: string, percentValue: string): void => {
    const data = rampData();
    if (!data || !isValidPositionPercentDraft(percentValue)) return;
    setRampPositionDraft(percentValue);
    if (percentValue === '' || percentValue === '.') return;
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
    if (!data || !ramp || !isValidPositionPercentDraft(percentValue)) return;
    setStopPositionDraft(percentValue);
    if (percentValue === '' || percentValue === '.') return;
    const parsed = Number(percentValue);
    if (!Number.isFinite(parsed)) return;
    setRampData(updateRamp(data, moveStop(ramp, stopId, parsed / 100)));
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

  const handleRampPositionWheel = (rampId: string, currentPosition: number, event: WheelEvent): void => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? POSITION_PERCENT_STEP / 100 : -POSITION_PERCENT_STEP / 100;
    handleRampPositionChange(rampId, formatPositionPercent(Math.max(0, Math.min(1, currentPosition + delta))));
  };

  const handleStopPositionWheel = (stopId: string, currentPosition: number, event: WheelEvent): void => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? POSITION_PERCENT_STEP / 100 : -POSITION_PERCENT_STEP / 100;
    handleStopPositionChange(stopId, formatPositionPercent(Math.max(0, Math.min(1, currentPosition + delta))));
  };

  const handleStopAlphaWheel = (stopId: string, currentAlpha: number, event: WheelEvent): void => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.01 : -0.01;
    handleStopAlphaChange(stopId, String(Math.round(Math.max(0, Math.min(1, currentAlpha + delta)) * 100)));
  };

  const getDuplicatePosition = (positions: readonly number[], index: number): number | null => {
    const current = positions[index];
    if (current === undefined) return null;
    const prevGap = index > 0 ? current - positions[index - 1]! : -1;
    const nextGap = index < positions.length - 1 ? positions[index + 1]! - current : -1;
    if (nextGap > 0 && (prevGap <= 0 || nextGap >= prevGap)) return current + nextGap / 2;
    if (prevGap > 0) return current - prevGap / 2;
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
    const duplicatedRamp: ColorRamp = { id: uid('ramp'), position: duplicatePosition, stops: ramp.stops.map(stop => ({ ...stop, id: uid('stop') })) };
    const nextData = { ...data, ramps: [...data.ramps, duplicatedRamp].sort((a, b) => a.position - b.position) };
    setRampData(nextData);
    setSelectedRampId(duplicatedRamp.id);
    setFocusedStopId(duplicatedRamp.stops[0]?.id ?? null);
  };

  const handleInvertSelectedRamp = (): void => {
    const data = rampData();
    const ramp = selectedRamp();
    if (!data || !ramp) return;
    const selectedId = ramp.id;
    const focusedId = focusedStopId();
    const invertedRamps = [...data.ramps].reverse().map(candidate => ({ ...candidate, position: 1 - candidate.position })).sort((a, b) => a.position - b.position);
    setRampData({ ...data, ramps: invertedRamps });
    setSelectedRampId(selectedId);
    setFocusedStopId(focusedId);
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
    const duplicatedStop: ColorStop = { ...stop, id: uid('stop'), position: duplicatePosition };
    const updatedRamp: ColorRamp = { ...ramp, stops: [...ramp.stops, duplicatedStop].sort((a, b) => a.position - b.position) };
    setRampData(updateRamp(data, updatedRamp));
    setFocusedStopId(duplicatedStop.id);
  };

  const handleInvertFocusedStop = (): void => {
    const data = rampData();
    const ramp = selectedRamp();
    const stop = focusedStop();
    if (!data || !ramp || !stop) return;
    const updatedRamp: ColorRamp = { ...ramp, stops: [...ramp.stops].reverse().map(candidate => ({ ...candidate, position: 1 - candidate.position })).sort((a, b) => a.position - b.position) };
    setRampData(updateRamp(data, updatedRamp));
    setFocusedStopId(stop.id);
  };

  const startRampDrag = (rampId: string, event: PointerEvent): void => {
    event.preventDefault();
    let pendingDelete = false;
    const onMove = (moveEvent: PointerEvent): void => {
      const strip = rampKnobStripRef;
      if (!strip) return;
      const rect = strip.getBoundingClientRect();
      const swapped = !!rampData()?.axisSwap;
      const newY = swapped
        ? Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width))
        : Math.max(0, Math.min(1, (moveEvent.clientY - rect.top) / rect.height));
      const deleteDist = swapped ? moveEvent.clientY - rect.bottom : moveEvent.clientX - rect.right;
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

  const startStopDrag = (stopId: string, event: PointerEvent): void => {
    event.preventDefault();
    let pendingDelete = false;
    const onMove = (moveEvent: PointerEvent): void => {
      const strip = stopKnobStripRef;
      if (!strip) return;
      const rect = strip.getBoundingClientRect();
      const swapped = !!rampData()?.axisSwap;
      const newPos = swapped
        ? Math.max(0, Math.min(1, (moveEvent.clientY - rect.top) / rect.height))
        : Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
      const deleteDist = swapped ? moveEvent.clientX - rect.right : moveEvent.clientY - rect.bottom;
      const nowDelete = !isStopBoundary(stopId) && deleteDist > DRAG_DELETE_THRESHOLD;
      pendingDelete = nowDelete;
      setDraggingStopDeleteId(nowDelete ? stopId : null);
      if (!nowDelete) {
        const data = rampData();
        const ramp = selectedRamp();
        if (data && ramp) setRampData(updateRamp(data, moveStop(ramp, stopId, newPos)));
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

  const startPreviewStopDrag = (stopId: string, event: PointerEvent): void => {
    event.preventDefault();
    const onMove = (moveEvent: PointerEvent): void => {
      const bar = stopPreviewBarRef;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const newPos = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
      const data = rampData();
      const ramp = selectedRamp();
      if (data && ramp) setRampData(updateRamp(data, moveStop(ramp, stopId, newPos)));
    };
    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  const handleRampStripPointerDown = (event: PointerEvent): void => {
    const strip = rampKnobStripRef;
    if (!strip || event.target !== strip) return;
    const rect = strip.getBoundingClientRect();
    const swapped = !!rampData()?.axisSwap;
    const y = swapped
      ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
      : Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    handleAddRampAtY(y);
  };

  const handleStopStripPointerDown = (event: PointerEvent): void => {
    const strip = stopKnobStripRef;
    if (!strip || event.target !== strip) return;
    const rect = strip.getBoundingClientRect();
    const swapped = !!rampData()?.axisSwap;
    const x = swapped
      ? Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
      : Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    handleAddStopAtPos(x);
  };

  const handleCanvasClick = (event: MouseEvent): void => {
    const data = rampData();
    const canvas = previewCanvasRef;
    if (!data || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const relX = (event.clientX - rect.left) / rect.width;
    const relY = (event.clientY - rect.top) / rect.height;
    const swapped = !!data.axisSwap;
    const rampAxis = swapped ? relX : relY;
    const stopAxis = swapped ? relY : relX;

    let nearestRamp: ColorRamp | null = null;
    let bestRampDist = Infinity;
    for (const ramp of data.ramps) {
      const dist = Math.abs(ramp.position - rampAxis);
      if (dist < bestRampDist) {
        bestRampDist = dist;
        nearestRamp = ramp;
      }
    }
    if (!nearestRamp) return;
    setSelectedRampId(nearestRamp.id);

    let nearestStop: ColorStop | null = null;
    let bestStopDist = Infinity;
    for (const stop of nearestRamp.stops) {
      const dist = Math.abs(stop.position - stopAxis);
      if (dist < bestStopDist) {
        bestStopDist = dist;
        nearestStop = stop;
      }
    }
    if (nearestStop) setFocusedStopId(nearestStop.id);
  };

  const startRampListDrag = (rampIdx: number, event: PointerEvent): void => {
    const startX = event.clientX;
    const startY = event.clientY;
    const moveThreshold = 4;
    let dragStarted = false;
    rampListDragOccurredRef = false;

    const onMove = (moveEvent: PointerEvent): void => {
      if (!dragStarted) {
        if (Math.abs(moveEvent.clientX - startX) < moveThreshold && Math.abs(moveEvent.clientY - startY) < moveThreshold) return;
        dragStarted = true;
        rampListDragOccurredRef = true;
        moveEvent.preventDefault();
        setDraggingRampListIdx(rampIdx);
        setRampListDropIdx(null);
      }

      const data = rampData();
      if (!data) return;
      let dropIdx = 0;
      for (let index = 0; index < data.ramps.length; index += 1) {
        const ramp = data.ramps[index]!;
        const element = rampRowElMap.get(ramp.id);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (moveEvent.clientY < rect.top + rect.height / 2) {
          dropIdx = index;
          break;
        }
        dropIdx = index + 1;
      }
      setRampListDropIdx(dropIdx);
    };

    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      if (dragStarted) {
        const dropIdx = rampListDropIdx();
        const data = rampData();
        if (dropIdx !== null && data) {
          const nextData = reorderRamps(data, rampIdx, dropIdx);
          if (nextData !== data) setRampData(nextData);
        }
        setDraggingRampListIdx(null);
        setRampListDropIdx(null);
      }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  const showDropBefore = (idx: number): boolean => {
    const dragIdx = draggingRampListIdx();
    const dropIdx = rampListDropIdx();
    if (dragIdx === null || dropIdx === null || dropIdx !== idx) return false;
    return idx !== dragIdx && idx !== dragIdx + 1;
  };

  const showDropAfterLast = (): boolean => {
    const data = rampData();
    const dragIdx = draggingRampListIdx();
    const dropIdx = rampListDropIdx();
    if (!data || dragIdx === null || dropIdx === null || dropIdx !== data.ramps.length) return false;
    return dragIdx !== data.ramps.length - 1;
  };

  const handleApply = (): void => {
    const data = rampData();
    if (!data) return;
    const lutId = editingLutId();
    const nextLut = createLutFromColorRamp2d(data);
    setInitialSerializedRampData(serializeRampData(data));
    props.options.onApply(lutId, nextLut);
    props.options.onClose();
  };

  const rampSwatchStyle = (ramp: ColorRamp): string => {
    const stops = ramp.stops.map(stop => `${colorToHex(stop.color)} ${Math.round(stop.position * 100)}%`);
    return `background: linear-gradient(to right, ${stops.join(', ')})`;
  };

  const canRemoveRamp = (rampId: string): boolean => {
    const data = rampData();
    if (!data || data.ramps.length <= MIN_RAMPS) return false;
    const idx = data.ramps.findIndex(ramp => ramp.id === rampId);
    return idx > 0 && idx < data.ramps.length - 1;
  };

  return (
    <div class={styles.root}>
      <div class={styles.head}>
        <input
          id="lut-editor-dialog-title"
          type="text"
          class={styles.titleInput}
          value={rampData()?.name ?? ''}
          onInput={event => {
            const name = (event.target as HTMLInputElement).value;
            const data = rampData();
            if (data) setRampData({ ...data, name });
          }}
        />
        <div class={styles.headActions}>
          <button type="button" class={cx(ui.buttonBase, ui.submitButton)} onClick={handleApply} disabled={!rampData()}>
            {tr('lutEditor.apply')}
          </button>
          <button type="button" class={cx(ui.buttonBase, ui.secondaryButton)} onClick={props.options.onClose}>
            {tr('lutEditor.cancel')}
          </button>
        </div>
      </div>

      <div class={styles.body}>
        <LutEditorPreview
          tr={tr}
          rampData={rampData}
          selectedRampId={selectedRampId}
          focusedStopId={focusedStopId}
          previewCanvasRef={() => previewCanvasRef}
          setPreviewCanvasRef={element => { previewCanvasRef = element; }}
          rampKnobStripRef={() => rampKnobStripRef}
          setRampKnobStripRef={element => { rampKnobStripRef = element; }}
          stopKnobStripRef={() => stopKnobStripRef}
          setStopKnobStripRef={element => { stopKnobStripRef = element; }}
          isRampBoundary={isRampBoundary}
          isStopBoundary={isStopBoundary}
          draggingRampDeleteId={draggingRampDeleteId}
          draggingStopDeleteId={draggingStopDeleteId}
          onCanvasClick={handleCanvasClick}
          onRampStripPointerDown={handleRampStripPointerDown}
          onStopStripPointerDown={handleStopStripPointerDown}
          onRampPointerDown={startRampDrag}
          onStopPointerDown={startStopDrag}
          onSelectRamp={setSelectedRampId}
          onSelectStop={setFocusedStopId}
          onAxisSwapChange={swapped => {
            const data = rampData();
            if (data) setRampData({ ...data, axisSwap: swapped });
          }}
        />

        <div class={styles.rightCol}>
          <LutEditorRampSection
            tr={tr}
            rampData={rampData}
            selectedRamp={selectedRamp}
            selectedRampId={selectedRampId}
            draggingRampListIdx={draggingRampListIdx}
            showDropBefore={showDropBefore}
            showDropAfterLast={showDropAfterLast}
            canRemoveRamp={canRemoveRamp}
            rampSwatchStyle={rampSwatchStyle}
            rampRowElMap={rampRowElMap}
            editingRampPositionId={editingRampPositionId}
            rampPositionDraft={rampPositionDraft}
            rampPositionInputRef={() => rampPositionInputRef}
            setRampPositionInputRef={input => { rampPositionInputRef = input; }}
            onAddRamp={handleAddRamp}
            onSelectRamp={setSelectedRampId}
            onRemoveRamp={handleRemoveRamp}
            onDuplicateSelectedRamp={handleDuplicateSelectedRamp}
            onInvertSelectedRamp={handleInvertSelectedRamp}
            onStartRampListDrag={startRampListDrag}
            didRampListDragOccur={() => rampListDragOccurredRef}
            onBeginRampPositionEdit={(rampId, position) => {
              setEditingRampPositionId(rampId);
              setRampPositionDraft(formatPositionPercent(position));
            }}
            onRampPositionInput={handleRampPositionChange}
            onCommitRampPositionDraft={commitRampPositionDraft}
            onCancelRampPositionDraft={position => {
              setEditingRampPositionId(null);
              setRampPositionDraft(formatPositionPercent(position));
            }}
            onRampPositionWheel={handleRampPositionWheel}
          />

          <LutEditorStopSection
            tr={tr}
            selectedRamp={selectedRamp}
            focusedStop={focusedStop}
            stopKnobPlacements={stopKnobPlacements}
            stopPreviewBarRef={() => stopPreviewBarRef}
            setStopPreviewBarRef={element => { stopPreviewBarRef = element; }}
            editingStopPositionId={editingStopPositionId}
            stopPositionDraft={stopPositionDraft}
            stopPositionInputRef={() => stopPositionInputRef}
            setStopPositionInputRef={input => { stopPositionInputRef = input; }}
            isStopBoundary={isStopBoundary}
            onAddStop={handleAddStop}
            onRemoveStop={handleRemoveStop}
            onDuplicateFocusedStop={handleDuplicateFocusedStop}
            onInvertFocusedStop={handleInvertFocusedStop}
            onSelectStop={setFocusedStopId}
            onPreviewStopPointerDown={startPreviewStopDrag}
            onStopColorChange={handleStopColorChange}
            onStopAlphaChange={handleStopAlphaChange}
            onBeginStopPositionEdit={(stopId, position) => {
              setEditingStopPositionId(stopId);
              setStopPositionDraft(formatPositionPercent(position));
            }}
            onStopPositionInput={handleStopPositionChange}
            onCommitStopPositionDraft={commitStopPositionDraft}
            onCancelStopPositionDraft={position => {
              setEditingStopPositionId(null);
              setStopPositionDraft(formatPositionPercent(position));
            }}
            onStopPositionWheel={handleStopPositionWheel}
            onStopAlphaWheel={handleStopAlphaWheel}
            rampSwatchStyle={rampSwatchStyle}
          />
        </div>
      </div>
    </div>
  );
}

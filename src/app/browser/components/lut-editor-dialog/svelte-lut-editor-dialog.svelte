<svelte:options customElement={{ tag: 'lut-lut-editor-dialog-content', shadow: 'none' }} />

<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
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
  import type { LutModel } from '../../../../features/step/step-model.ts';
  import { getLanguage, subscribeLanguageChange, t } from '../../i18n.ts';
  import { createPointerReorderListController, syncReorderDropIndicators } from '../../interactions/reorder-list.ts';
  import Button from '../svelte-button.svelte';
  import PreviewPane from './lut-editor-preview-pane.svelte';
  import RampSection from './lut-editor-ramp-section.svelte';
  import StopSection from './lut-editor-stop-section.svelte';
  import { createPointerSessionManager } from './pointer-session.ts';
  import {
      DRAG_DELETE_THRESHOLD,
      POSITION_PERCENT_STEP,
      formatPositionPercent,
      isValidPositionPercentDraft,
      serializeRampData,
  } from './shared.ts';

  let {
    rampData = null,
    lutId = null,
  }: {
    rampData?: ColorRamp2dLutData | null;
    lutId?: string | null;
  } = $props();

  const dispatch = createEventDispatcher<{
    dirtychange: boolean;
    'apply-lut': { lutId: string | null; updatedLut: LutModel };
    'request-close': undefined;
  }>();

  let language = $state(getLanguage());
  const disposeLanguageSync = subscribeLanguageChange(nextLanguage => {
    language = nextLanguage;
  });

  let previewCanvasRef = $state<HTMLCanvasElement | null>(null);
  let editingLutId = $state<string | null>(null);
  let selectedRampId = $state<string | null>(null);
  let focusedStopId = $state<string | null>(null);
  let initialSerializedRampData = $state('');
  let editingRampPositionId = $state<string | null>(null);
  let rampPositionDraft = $state('');
  let editingStopPositionId = $state<string | null>(null);
  let stopPositionDraft = $state('');
  let draggingRampDeleteId = $state<string | null>(null);
  let draggingStopDeleteId = $state<string | null>(null);
  let draggingRampListIdx = $state<number | null>(null);
  let rampListDropTargetId = $state<string | null>(null);
  let rampListDropAfter = $state(false);
  let rafPendingId = $state<number | null>(null);
  let previewRevision = $state(0);
  let previousSyncKey = $state('');
  let lastDispatchedDirty = $state<boolean | null>(null);
  let editorRampData = $state.raw<ColorRamp2dLutData | null>(null);

  const pointerSessionManager = createPointerSessionManager();

  onDestroy(() => {
    disposeLanguageSync();
    if (rafPendingId !== null) {
      cancelAnimationFrame(rafPendingId);
      rafPendingId = null;
    }
    pointerSessionManager.cleanupPointerSession();
  });

  function tr(key: Parameters<typeof t>[0], values?: Record<string, string | number>): string {
    language;
    return values ? t(key, values as never) : t(key);
  }

  const syncKey = $derived(`${lutId ?? '__new__'}::${serializeRampData(rampData)}`);
  $effect(() => {
    if (syncKey === previousSyncKey) {
      return;
    }

    previousSyncKey = syncKey;
    editingLutId = lutId;
    editorRampData = rampData;
    initialSerializedRampData = serializeRampData(editorRampData);
    selectedRampId = editorRampData?.ramps[0]?.id ?? null;
    focusedStopId = editorRampData?.ramps[0]?.stops[0]?.id ?? null;
    editingRampPositionId = null;
    rampPositionDraft = '';
    editingStopPositionId = null;
    stopPositionDraft = '';
    draggingRampDeleteId = null;
    draggingStopDeleteId = null;
    draggingRampListIdx = null;
    rampListDropTargetId = null;
    rampListDropAfter = false;
    previewRevision += 1;
  });

  const selectedRamp = $derived(editorRampData && selectedRampId
    ? editorRampData.ramps.find(ramp => ramp.id === selectedRampId) ?? null
    : null);

  const focusedStop = $derived(selectedRamp && focusedStopId
    ? selectedRamp.stops.find(stop => stop.id === focusedStopId) ?? null
    : null);

  const isDirty = $derived(serializeRampData(editorRampData) !== initialSerializedRampData);
  $effect(() => {
    if (isDirty === lastDispatchedDirty) {
      return;
    }
    lastDispatchedDirty = isDirty;
    dispatch('dirtychange', isDirty);
  });

  $effect(() => {
    if (!selectedRamp) {
      focusedStopId = null;
      editingRampPositionId = null;
      rampPositionDraft = '';
      return;
    }

    if (editingRampPositionId !== selectedRamp.id) {
      rampPositionDraft = formatPositionPercent(selectedRamp.position);
    }

    if (!focusedStopId || !selectedRamp.stops.some(stop => stop.id === focusedStopId)) {
      focusedStopId = selectedRamp.stops[0]?.id ?? null;
    }
  });

  $effect(() => {
    if (!focusedStop) {
      editingStopPositionId = null;
      stopPositionDraft = '';
      return;
    }

    if (editingStopPositionId !== focusedStop.id) {
      stopPositionDraft = formatPositionPercent(focusedStop.position);
    }
  });

  $effect(() => {
    previewRevision;
    previewCanvasRef;
    editorRampData?.axisSwap;
    editorRampData?.width;
    editorRampData?.height;
    selectedRamp?.position;
    focusedStop?.position;
    scheduleRedraw();
  });

  function handlePreviewCanvasRef(element: HTMLCanvasElement | null): void {
    previewCanvasRef = element;
    scheduleRedraw();
  }

  function scheduleRedraw(): void {
    if (rafPendingId !== null) {
      return;
    }

    rafPendingId = requestAnimationFrame(() => {
      rafPendingId = null;
      redrawPreview();
    });
  }

  function redrawPreview(): void {
    if (!editorRampData || !previewCanvasRef) {
      return;
    }

    const context = previewCanvasRef.getContext('2d');
    if (!context) {
      return;
    }

    const pixels = renderColorRamp2dToPixels(editorRampData);
    const imageData = context.createImageData(editorRampData.width, editorRampData.height);
    imageData.data.set(pixels);
    context.putImageData(imageData, 0, 0);

    const swapped = !!editorRampData.axisSwap;
    if (selectedRamp) {
      const pos = Math.round(selectedRamp.position * ((swapped ? editorRampData.width : editorRampData.height) - 1));
      context.strokeStyle = 'rgba(255,255,255,0.5)';
      context.lineWidth = 1;
      context.setLineDash([3, 3]);
      context.beginPath();
      if (swapped) {
        context.moveTo(pos + 0.5, 0);
        context.lineTo(pos + 0.5, editorRampData.height);
      } else {
        context.moveTo(0, pos + 0.5);
        context.lineTo(editorRampData.width, pos + 0.5);
      }
      context.stroke();
      context.setLineDash([]);
    }

    if (focusedStop) {
      const pos = Math.round(focusedStop.position * ((swapped ? editorRampData.height : editorRampData.width) - 1));
      context.strokeStyle = 'rgba(255,255,255,0.5)';
      context.lineWidth = 1;
      context.setLineDash([3, 3]);
      context.beginPath();
      if (swapped) {
        context.moveTo(0, pos + 0.5);
        context.lineTo(editorRampData.width, pos + 0.5);
      } else {
        context.moveTo(pos + 0.5, 0);
        context.lineTo(pos + 0.5, editorRampData.height);
      }
      context.stroke();
      context.setLineDash([]);
    }
  }

  function setNextRampData(nextData: ColorRamp2dLutData): void {
    editorRampData = nextData;
    previewRevision += 1;
  }

  function isRampBoundary(rampId: string): boolean {
    if (!editorRampData) {
      return false;
    }
    const index = editorRampData.ramps.findIndex(ramp => ramp.id === rampId);
    return index === 0 || index === editorRampData.ramps.length - 1;
  }

  function isStopBoundary(stopId: string): boolean {
    if (!selectedRamp) {
      return false;
    }
    const index = selectedRamp.stops.findIndex(stop => stop.id === stopId);
    return index === 0 || index === selectedRamp.stops.length - 1;
  }

  function canRemoveRamp(rampId: string): boolean {
    if (!editorRampData || editorRampData.ramps.length <= MIN_RAMPS) {
      return false;
    }
    const index = editorRampData.ramps.findIndex(ramp => ramp.id === rampId);
    return index > 0 && index < editorRampData.ramps.length - 1;
  }

  function handleRemoveRamp(rampId: string): void {
    if (!editorRampData) {
      return;
    }
    const nextData = removeRamp(editorRampData, rampId);
    setNextRampData(nextData);
    if (selectedRampId === rampId) {
      selectedRampId = nextData.ramps[0]?.id ?? null;
    }
  }

  function handleAddRampAtY(position: number): void {
    if (!editorRampData || editorRampData.ramps.length >= MAX_RAMPS) {
      return;
    }
    const nextData = addRamp(editorRampData, position);
    setNextRampData(nextData);
    const addedRamp = nextData.ramps.find(ramp => !editorRampData?.ramps.some(oldRamp => oldRamp.id === ramp.id));
    if (addedRamp) {
      selectedRampId = addedRamp.id;
    }
  }

  function handleAddRamp(): void {
    if (!editorRampData || editorRampData.ramps.length >= MAX_RAMPS) {
      return;
    }
    let bestGap = 0;
    let bestY = 0.5;
    for (let index = 0; index < editorRampData.ramps.length - 1; index += 1) {
      const currentRamp = editorRampData.ramps[index];
      const nextRamp = editorRampData.ramps[index + 1];
      if (!currentRamp || !nextRamp) {
        continue;
      }
      const gap = nextRamp.position - currentRamp.position;
      if (gap > bestGap) {
        bestGap = gap;
        bestY = (currentRamp.position + nextRamp.position) / 2;
      }
    }
    handleAddRampAtY(bestY);
  }

  function handleRemoveStop(stopId: string): void {
    if (!editorRampData || !selectedRamp) {
      return;
    }
    const nextRamp = removeStop(selectedRamp, stopId);
    setNextRampData(updateRamp(editorRampData, nextRamp));
    if (focusedStopId === stopId) {
      focusedStopId = nextRamp.stops[0]?.id ?? null;
    }
  }

  function handleAddStopAtPos(position: number): void {
    if (!editorRampData || !selectedRamp || selectedRamp.stops.length >= MAX_STOPS_PER_RAMP) {
      return;
    }
    const nextRamp = addStop(selectedRamp, position);
    setNextRampData(updateRamp(editorRampData, nextRamp));
    const addedStop = nextRamp.stops.find(stop => !selectedRamp?.stops.some(oldStop => oldStop.id === stop.id));
    if (addedStop) {
      focusedStopId = addedStop.id;
    }
  }

  function handleAddStop(): void {
    if (!selectedRamp) {
      return;
    }
    let bestGap = 0;
    let bestPos = 0.5;
    for (let index = 0; index < selectedRamp.stops.length - 1; index += 1) {
      const currentStop = selectedRamp.stops[index];
      const nextStop = selectedRamp.stops[index + 1];
      if (!currentStop || !nextStop) {
        continue;
      }
      const gap = nextStop.position - currentStop.position;
      if (gap > bestGap) {
        bestGap = gap;
        bestPos = (currentStop.position + nextStop.position) / 2;
      }
    }
    handleAddStopAtPos(bestPos);
  }

  function handleStopColorChange(stopId: string, hexValue: string): void {
    if (!editorRampData || !selectedRamp) {
      return;
    }
    const color = parseHexColor(hexValue);
    if (!color) {
      return;
    }
    setNextRampData(updateRamp(editorRampData, updateStopColor(selectedRamp, stopId, color)));
  }

  function handleStopAlphaChange(stopId: string, value: string): void {
    if (!editorRampData || !selectedRamp) {
      return;
    }
    setNextRampData(updateRamp(editorRampData, updateStopAlpha(selectedRamp, stopId, Number(value) / 100)));
  }

  function beginRampPositionEdit(rampId: string, currentDraft: string): void {
    editingRampPositionId = rampId;
    rampPositionDraft = currentDraft;
  }

  function cancelRampPositionEdit(currentDraft: string): void {
    editingRampPositionId = null;
    rampPositionDraft = currentDraft;
  }

  function handleRampPositionChange(rampId: string, percentValue: string): void {
    if (!editorRampData || !isValidPositionPercentDraft(percentValue)) {
      return;
    }
    rampPositionDraft = percentValue;
    if (percentValue === '' || percentValue === '.') {
      return;
    }
    const parsed = Number(percentValue);
    if (!Number.isFinite(parsed)) {
      return;
    }
    setNextRampData(moveRamp(editorRampData, rampId, parsed / 100));
  }

  function commitRampPositionDraft(rampId: string): void {
    const ramp = editorRampData?.ramps.find(item => item.id === rampId) ?? selectedRamp;
    const parsed = Number(rampPositionDraft);
    editingRampPositionId = null;
    if (!ramp || !Number.isFinite(parsed)) {
      rampPositionDraft = ramp ? formatPositionPercent(ramp.position) : '';
      return;
    }
    const normalized = formatPositionPercent(parsed / 100);
    handleRampPositionChange(rampId, normalized);
    rampPositionDraft = normalized;
  }

  function handleRampPositionWheel(rampId: string, currentPosition: number, event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY < 0 ? POSITION_PERCENT_STEP / 100 : -POSITION_PERCENT_STEP / 100;
    handleRampPositionChange(rampId, formatPositionPercent(Math.max(0, Math.min(1, currentPosition + delta))));
  }

  function beginStopPositionEdit(stopId: string, currentDraft: string): void {
    editingStopPositionId = stopId;
    stopPositionDraft = currentDraft;
  }

  function cancelStopPositionEdit(currentDraft: string): void {
    editingStopPositionId = null;
    stopPositionDraft = currentDraft;
  }

  function handleStopPositionChange(stopId: string, percentValue: string): void {
    if (!editorRampData || !selectedRamp || !isValidPositionPercentDraft(percentValue)) {
      return;
    }
    stopPositionDraft = percentValue;
    if (percentValue === '' || percentValue === '.') {
      return;
    }
    const parsed = Number(percentValue);
    if (!Number.isFinite(parsed)) {
      return;
    }
    setNextRampData(updateRamp(editorRampData, moveStop(selectedRamp, stopId, parsed / 100)));
  }

  function commitStopPositionDraft(stopId: string): void {
    const parsed = Number(stopPositionDraft);
    editingStopPositionId = null;
    if (!focusedStop || focusedStop.id !== stopId || !Number.isFinite(parsed)) {
      stopPositionDraft = focusedStop ? formatPositionPercent(focusedStop.position) : '';
      return;
    }
    const normalized = formatPositionPercent(parsed / 100);
    handleStopPositionChange(stopId, normalized);
    stopPositionDraft = normalized;
  }

  function handleStopPositionWheel(stopId: string, currentPosition: number, event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY < 0 ? POSITION_PERCENT_STEP / 100 : -POSITION_PERCENT_STEP / 100;
    handleStopPositionChange(stopId, formatPositionPercent(Math.max(0, Math.min(1, currentPosition + delta))));
  }

  function handleStopAlphaWheel(stopId: string, currentAlpha: number, event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.01 : -0.01;
    handleStopAlphaChange(stopId, String(Math.round(Math.max(0, Math.min(1, currentAlpha + delta)) * 100)));
  }

  function getDuplicatePosition(positions: readonly number[], index: number): number | null {
    const current = positions[index];
    if (current === undefined) {
      return null;
    }
    const prevGap = index > 0 ? current - positions[index - 1]! : -1;
    const nextGap = index < positions.length - 1 ? positions[index + 1]! - current : -1;
    if (nextGap > 0 && (prevGap <= 0 || nextGap >= prevGap)) {
      return current + nextGap / 2;
    }
    if (prevGap > 0) {
      return current - prevGap / 2;
    }
    return null;
  }

  function handleDuplicateSelectedRamp(): void {
    if (!editorRampData || !selectedRamp || editorRampData.ramps.length >= MAX_RAMPS) {
      return;
    }
    const rampIndex = editorRampData.ramps.findIndex(candidate => candidate.id === selectedRamp.id);
    if (rampIndex < 0) {
      return;
    }
    const duplicatePosition = getDuplicatePosition(editorRampData.ramps.map(candidate => candidate.position), rampIndex);
    if (duplicatePosition === null) {
      return;
    }
    const duplicatedRamp: ColorRamp = {
      id: uid('ramp'),
      position: duplicatePosition,
      stops: selectedRamp.stops.map(stop => ({ ...stop, id: uid('stop') })),
    };
    const nextData: ColorRamp2dLutData = {
      ...editorRampData,
      ramps: [...editorRampData.ramps, duplicatedRamp].sort((a, b) => a.position - b.position),
    };
    setNextRampData(nextData);
    selectedRampId = duplicatedRamp.id;
    focusedStopId = duplicatedRamp.stops[0]?.id ?? null;
  }

  function handleInvertSelectedRamp(): void {
    if (!editorRampData || !selectedRamp) {
      return;
    }
    const selectedId = selectedRamp.id;
    const currentFocusedStopId = focusedStopId;
    const invertedRamps = [...editorRampData.ramps]
      .reverse()
      .map(ramp => ({ ...ramp, position: 1 - ramp.position }))
      .sort((a, b) => a.position - b.position);
    setNextRampData({ ...editorRampData, ramps: invertedRamps });
    selectedRampId = selectedId;
    focusedStopId = currentFocusedStopId;
  }

  function handleDuplicateFocusedStop(): void {
    if (!editorRampData || !selectedRamp || !focusedStop || selectedRamp.stops.length >= MAX_STOPS_PER_RAMP) {
      return;
    }
    const stopIndex = selectedRamp.stops.findIndex(candidate => candidate.id === focusedStop.id);
    if (stopIndex < 0) {
      return;
    }
    const duplicatePosition = getDuplicatePosition(selectedRamp.stops.map(candidate => candidate.position), stopIndex);
    if (duplicatePosition === null) {
      return;
    }
    const duplicatedStop: ColorStop = { ...focusedStop, id: uid('stop'), position: duplicatePosition };
    const updatedRamp: ColorRamp = {
      ...selectedRamp,
      stops: [...selectedRamp.stops, duplicatedStop].sort((a, b) => a.position - b.position),
    };
    setNextRampData(updateRamp(editorRampData, updatedRamp));
    focusedStopId = duplicatedStop.id;
  }

  function handleInvertFocusedStop(): void {
    if (!editorRampData || !selectedRamp || !focusedStop) {
      return;
    }
    const updatedRamp: ColorRamp = {
      ...selectedRamp,
      stops: [...selectedRamp.stops]
        .reverse()
        .map(stop => ({ ...stop, position: 1 - stop.position }))
        .sort((a, b) => a.position - b.position),
    };
    setNextRampData(updateRamp(editorRampData, updatedRamp));
    focusedStopId = focusedStop.id;
  }

  function startRampDrag(rampId: string, event: PointerEvent, stripEl: HTMLDivElement | null): void {
    event.preventDefault();
    let pendingDelete = false;
    const onMove = (moveEvent: PointerEvent): void => {
      if (!stripEl) {
        return;
      }
      const rect = stripEl.getBoundingClientRect();
      const swapped = !!editorRampData?.axisSwap;
      const newPosition = swapped
        ? Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width))
        : Math.max(0, Math.min(1, (moveEvent.clientY - rect.top) / rect.height));
      const deleteDistance = swapped ? moveEvent.clientY - rect.bottom : moveEvent.clientX - rect.right;
      const nowDelete = !isRampBoundary(rampId) && deleteDistance > DRAG_DELETE_THRESHOLD;
      pendingDelete = nowDelete;
      draggingRampDeleteId = nowDelete ? rampId : null;
      if (!nowDelete && editorRampData) {
        setNextRampData(moveRamp(editorRampData, rampId, newPosition));
      }
    };
    const onUp = (): void => {
      draggingRampDeleteId = null;
      if (pendingDelete) {
        handleRemoveRamp(rampId);
      }
    };
    pointerSessionManager.beginPointerSession(onMove, onUp);
  }

  function startStopDrag(stopId: string, event: PointerEvent, stripEl: HTMLDivElement | null): void {
    event.preventDefault();
    let pendingDelete = false;
    const onMove = (moveEvent: PointerEvent): void => {
      if (!stripEl) {
        return;
      }
      const rect = stripEl.getBoundingClientRect();
      const swapped = !!editorRampData?.axisSwap;
      const newPosition = swapped
        ? Math.max(0, Math.min(1, (moveEvent.clientY - rect.top) / rect.height))
        : Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
      const deleteDistance = swapped ? moveEvent.clientX - rect.right : moveEvent.clientY - rect.bottom;
      const nowDelete = !isStopBoundary(stopId) && deleteDistance > DRAG_DELETE_THRESHOLD;
      pendingDelete = nowDelete;
      draggingStopDeleteId = nowDelete ? stopId : null;
      if (!nowDelete && editorRampData && selectedRamp) {
        setNextRampData(updateRamp(editorRampData, moveStop(selectedRamp, stopId, newPosition)));
      }
    };
    const onUp = (): void => {
      draggingStopDeleteId = null;
      if (pendingDelete) {
        handleRemoveStop(stopId);
      }
    };
    pointerSessionManager.beginPointerSession(onMove, onUp);
  }

  function startPreviewStopDrag(stopId: string, event: PointerEvent, previewBarEl: HTMLDivElement | null): void {
    event.preventDefault();
    const onMove = (moveEvent: PointerEvent): void => {
      if (!previewBarEl || !editorRampData || !selectedRamp) {
        return;
      }
      const rect = previewBarEl.getBoundingClientRect();
      const newPosition = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
      setNextRampData(updateRamp(editorRampData, moveStop(selectedRamp, stopId, newPosition)));
    };
    pointerSessionManager.beginPointerSession(onMove, () => undefined);
  }

  function handleRampStripPointerDown(event: PointerEvent, stripEl: HTMLDivElement | null): void {
    if (!stripEl || event.target !== stripEl) {
      return;
    }
    const rect = stripEl.getBoundingClientRect();
    const swapped = !!editorRampData?.axisSwap;
    const position = swapped
      ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
      : Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    handleAddRampAtY(position);
  }

  function handleStopStripPointerDown(event: PointerEvent, stripEl: HTMLDivElement | null): void {
    if (!stripEl || event.target !== stripEl) {
      return;
    }
    const rect = stripEl.getBoundingClientRect();
    const swapped = !!editorRampData?.axisSwap;
    const position = swapped
      ? Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
      : Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    handleAddStopAtPos(position);
  }

  function handleCanvasClick(event: MouseEvent, canvasEl: HTMLCanvasElement | null): void {
    if (!editorRampData || !canvasEl) {
      return;
    }
    const rect = canvasEl.getBoundingClientRect();
    const relX = (event.clientX - rect.left) / rect.width;
    const relY = (event.clientY - rect.top) / rect.height;
    const swapped = !!editorRampData.axisSwap;
    const rampAxis = swapped ? relX : relY;
    const stopAxis = swapped ? relY : relX;

    let nearestRamp: ColorRamp | null = null;
    let bestRampDistance = Infinity;
    for (const ramp of editorRampData.ramps) {
      const distance = Math.abs(ramp.position - rampAxis);
      if (distance < bestRampDistance) {
        bestRampDistance = distance;
        nearestRamp = ramp;
      }
    }
    if (!nearestRamp) {
      return;
    }
    selectedRampId = nearestRamp.id;

    let nearestStop: ColorStop | null = null;
    let bestStopDistance = Infinity;
    for (const stop of nearestRamp.stops) {
      const distance = Math.abs(stop.position - stopAxis);
      if (distance < bestStopDistance) {
        bestStopDistance = distance;
        nearestStop = stop;
      }
    }
    if (nearestStop) {
      focusedStopId = nearestStop.id;
    }
  }

  const rampReorderController = createPointerReorderListController<string>({
    beginPointerSession: pointerSessionManager.beginPointerSession,
    getItems: () => editorRampData?.ramps ?? [],
    queryCandidateElements: () => Array.from(document.querySelectorAll<HTMLElement>('.ramp-list .ramp-row[data-ramp-id]')),
    getElementItemId: element => element.dataset.rampId ?? null,
    axis: 'vertical',
    getPointerCoord: event => event.clientY,
    setDraggingIndex: index => {
      draggingRampListIdx = index;
    },
    setDropTarget: (targetId, after) => {
      rampListDropTargetId = targetId;
      rampListDropAfter = after;
      syncReorderDropIndicators({
        elements: Array.from(document.querySelectorAll<HTMLElement>('.ramp-list .ramp-row[data-ramp-id]')),
        getElementItemId: element => element.dataset.rampId ?? null,
        dropTargetId: targetId,
        dropAfter: after,
      });
    },
    commitMove: (fromIndex, insertBeforeIndex) => {
      if (!editorRampData) {
        return;
      }
      const nextData = reorderRamps(editorRampData, fromIndex, insertBeforeIndex);
      if (nextData !== editorRampData) {
        setNextRampData(nextData);
      }
    },
  });

  function handleApply(): void {
    if (!editorRampData) {
      return;
    }
    const nextLut = createLutFromColorRamp2d(editorRampData);
    initialSerializedRampData = serializeRampData(editorRampData);
    dispatch('apply-lut', { lutId: editingLutId, updatedLut: nextLut });
    dispatch('request-close');
  }

  function rampSwatchStyle(ramp: ColorRamp): string {
    const stops = ramp.stops.map(stop => `${colorToHex(stop.color)} ${Math.round(stop.position * 100)}%`);
    return `background: linear-gradient(to right, ${stops.join(', ')})`;
  }
</script>

{#key language}
<div class="root">
  <div class="head">
    <input
      id="lut-editor-dialog-title"
      type="text"
      class="title-input"
      value={editorRampData?.name ?? ''}
      oninput={event => {
        const name = (event.currentTarget as HTMLInputElement).value;
        if (editorRampData) {
          setNextRampData({ ...editorRampData, name });
        }
      }}
    />
    <div class="head-actions">
      <Button variant="submit" handlePress={handleApply} disabled={!editorRampData}>
        {tr('lutEditor.apply')}
      </Button>
      <Button variant="secondary" handlePress={() => dispatch('request-close')}>
        {tr('lutEditor.cancel')}
      </Button>
    </div>
  </div>

  <div class="body">
    <PreviewPane
      {editorRampData}
      {selectedRampId}
      {focusedStopId}
      {selectedRamp}
      {draggingRampDeleteId}
      {draggingStopDeleteId}
      rampRailHint={tr('lutEditor.rampRailHint')}
      stopRailHint={tr('lutEditor.stopRailHint')}
      axisStopXRampYLabel={tr('lutEditor.axisStopXRampY')}
      axisRampXStopYLabel={tr('lutEditor.axisRampXStopY')}
      {isRampBoundary}
      {isStopBoundary}
      onCanvasRef={handlePreviewCanvasRef}
      onCanvasClick={handleCanvasClick}
      onRampStripPointerDown={handleRampStripPointerDown}
      onStopStripPointerDown={handleStopStripPointerDown}
      onRampKnobPointerDown={startRampDrag}
      onStopKnobPointerDown={startStopDrag}
      onPreviewStopPointerDown={startPreviewStopDrag}
      onAxisSwapChange={nextAxisSwap => {
        if (editorRampData) {
          setNextRampData({ ...editorRampData, axisSwap: nextAxisSwap });
        }
      }}
      onSelectRamp={rampId => {
        selectedRampId = rampId;
      }}
      onSelectStop={stopId => {
        focusedStopId = stopId;
      }}
    />

    <div class="right-col">
      <RampSection
        ramps={editorRampData?.ramps ?? []}
        {selectedRamp}
        {selectedRampId}
        {editingRampPositionId}
        {rampPositionDraft}
        {draggingRampListIdx}
        rampListLabel={tr('lutEditor.rampListLabel')}
        addRampLabel={tr('lutEditor.addRamp')}
        duplicateRampLabel={tr('lutEditor.duplicateRamp')}
        invertRampLabel={tr('lutEditor.invertRamp')}
        removeRampLabel={tr('lutEditor.removeRamp')}
        rampPositionLabel={tr('lutEditor.rampPosition')}
        rampMenuAriaLabel={tr('lutEditor.rampMenuAria')}
        maxRampsReached={!editorRampData || (editorRampData?.ramps.length ?? 0) >= MAX_RAMPS}
        {canRemoveRamp}
        {rampSwatchStyle}
        onAddRamp={handleAddRamp}
        onSelectRamp={rampId => {
          selectedRampId = rampId;
        }}
        onStartRampListDrag={rampReorderController.startDrag}
        onRemoveRamp={handleRemoveRamp}
        onDuplicateSelectedRamp={handleDuplicateSelectedRamp}
        onInvertSelectedRamp={handleInvertSelectedRamp}
        onBeginRampPositionEdit={beginRampPositionEdit}
        onRampPositionInput={handleRampPositionChange}
        onCommitRampPosition={commitRampPositionDraft}
        onCancelRampPositionEdit={cancelRampPositionEdit}
        onRampPositionWheel={handleRampPositionWheel}
        shouldSuppressRampClick={rampReorderController.shouldSuppressClick}
      />

      <StopSection
        {selectedRamp}
        {focusedStop}
        {stopPositionDraft}
        {editingStopPositionId}
        stopEditorLabel={tr('lutEditor.stopEditorLabel')}
        addStopLabel={tr('lutEditor.addStop')}
        removeStopLabel={tr('lutEditor.removeStop')}
        duplicateStopLabel={tr('lutEditor.duplicateStop')}
        invertStopLabel={tr('lutEditor.invertStop')}
        stopMenuAriaLabel={tr('lutEditor.stopMenuAria')}
        stopColorLabel={tr('lutEditor.stopColor')}
        stopPositionLabel={tr('lutEditor.stopPosition')}
        alphaLabel={tr('lutEditor.alpha')}
        noStopSelectedLabel={tr('lutEditor.noStopSelected')}
        maxStopsReached={!selectedRamp || (selectedRamp?.stops.length ?? 0) >= MAX_STOPS_PER_RAMP}
        {isStopBoundary}
        onAddStop={handleAddStop}
        onRemoveStop={handleRemoveStop}
        onDuplicateFocusedStop={handleDuplicateFocusedStop}
        onInvertFocusedStop={handleInvertFocusedStop}
        onSelectStop={stopId => {
          focusedStopId = stopId;
        }}
        onPreviewStopPointerDown={startPreviewStopDrag}
        onStopColorInput={handleStopColorChange}
        onBeginStopPositionEdit={beginStopPositionEdit}
        onStopPositionInput={handleStopPositionChange}
        onCommitStopPosition={commitStopPositionDraft}
        onCancelStopPositionEdit={cancelStopPositionEdit}
        onStopPositionWheel={handleStopPositionWheel}
        onStopAlphaInput={handleStopAlphaChange}
        onStopAlphaWheel={handleStopAlphaWheel}
      />
    </div>
  </div>
</div>
{/key}

<style>
  .root {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 20px;
    border-bottom: 1px solid var(--color-line);
    flex-shrink: 0;
  }

  .title-input {
    min-width: 0;
    flex: 1;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: var(--color-text-strong);
    font-size: 13px;
    font-weight: 600;
    padding: 4px 6px;
    margin: -4px 0 -4px -6px;
  }

  .title-input:hover {
    border-color: color-mix(in srgb, var(--color-line), var(--color-accent) 32%);
    background: color-mix(in srgb, var(--color-panel-2), var(--color-bg) 10%);
  }

  .title-input:focus {
    outline: none;
    border-color: var(--color-accent);
    background: color-mix(in srgb, var(--color-panel-2), var(--color-bg) 6%);
  }

  .head-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .right-col {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }

  :global(.lut-editor-menu-wrap) {
    position: relative;
  }

  :global(.lut-editor-menu-panel) {
    min-width: 180px;
    z-index: 220;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    border-radius: 12px;
    border: 1px solid var(--color-line);
    background: var(--color-panel);
    box-shadow: 0 14px 28px color-mix(in srgb, black, transparent 78%);
  }

  @media (max-width: 1120px) {
    .body {
      flex-direction: column;
    }
  }
</style>

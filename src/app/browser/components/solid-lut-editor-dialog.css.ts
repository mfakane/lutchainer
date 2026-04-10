import { style } from '@vanilla-extract/css';
import { vars } from '../styles/app-theme.css.ts';

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
});

export const head = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '14px 20px',
  borderBottom: `1px solid ${vars.color.line}`,
  flexShrink: 0,
});

export const titleInput = style({
  minWidth: 0,
  flex: 1,
  border: '1px solid transparent',
  borderRadius: '8px',
  background: 'transparent',
  color: vars.color.textStrong,
  fontSize: '13px',
  fontWeight: 600,
  padding: '4px 6px',
  margin: '-4px 0 -4px -6px',
  selectors: {
    '&:hover': {
      borderColor: `color-mix(in srgb, ${vars.color.line}, ${vars.color.accent} 32%)`,
      background: `color-mix(in srgb, ${vars.color.panel2}, #000 10%)`,
    },
    '&:focus': {
      outline: 'none',
      borderColor: vars.color.accent,
      background: `color-mix(in srgb, ${vars.color.panel2}, #000 6%)`,
    },
  },
});

export const headActions = style({
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
});

export const body = style({
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
});

export const previewCol = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
  gap: '8px',
  borderRight: `1px solid ${vars.color.line}`,
  flexShrink: 0,
});

export const canvasArea = style({
  display: 'grid',
  gridTemplateColumns: '256px 24px',
  gridTemplateRows: '256px 24px',
});

export const axisSwapped = style({});

export const canvasWrap = style({
  position: 'relative',
  width: '256px',
  height: '256px',
  border: `1px solid ${vars.color.controlBorder}`,
  borderRadius: '4px',
  cursor: 'crosshair',
});

export const canvas = style({
  display: 'block',
  width: '100%',
  height: '100%',
  imageRendering: 'pixelated',
});

export const axisOptions = style({
  display: 'flex',
  gap: '10px',
  padding: '4px 2px 0',
});

export const axisOption = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '11px',
  color: vars.color.muted,
  cursor: 'pointer',
  userSelect: 'none',
});

export const rampKnobStrip = style({
  position: 'relative',
  gridRow: 1,
  gridColumn: 2,
  cursor: 'crosshair',
  selectors: {
    [`${axisSwapped} &`]: {
      gridRow: 2,
      gridColumn: 1,
    },
  },
});

export const rampKnob = style({
  position: 'absolute',
  left: '4px',
  width: '14px',
  height: '14px',
  borderRadius: '50%',
  background: vars.color.muted,
  border: `2px solid color-mix(in srgb, ${vars.color.surfaceInset}, #000 30%)`,
  transform: 'translateY(-50%)',
  cursor: 'ns-resize',
  touchAction: 'none',
  transition: 'background 0.1s, box-shadow 0.1s, opacity 0.1s, transform 0.1s',
  selectors: {
    [`${axisSwapped} &`]: {
      left: 'auto',
      top: '4px',
      transform: 'translateX(-50%)',
      cursor: 'ew-resize',
    },
  },
});

export const selected = style({
  background: vars.color.accent,
  boxShadow: `0 0 0 2px color-mix(in srgb, ${vars.color.accent}, transparent 60%)`,
});

export const boundary = style({
  opacity: 0.6,
});

export const pendingDeleteRamp = style({
  background: '#f44',
  opacity: 0.55,
  transform: 'translateY(-50%) scale(0.75)',
  cursor: 'no-drop',
  selectors: {
    [`${axisSwapped} &`]: {
      transform: 'translateX(-50%) scale(0.75)',
    },
  },
});

export const stopKnobStrip = style({
  position: 'relative',
  gridRow: 2,
  gridColumn: 1,
  cursor: 'crosshair',
  selectors: {
    [`${axisSwapped} &`]: {
      gridRow: 1,
      gridColumn: 2,
    },
  },
});

export const stopKnob = style({
  position: 'absolute',
  top: '4px',
  width: '14px',
  height: '14px',
  borderRadius: '50%',
  border: `2px solid color-mix(in srgb, ${vars.color.surfaceInset}, #000 30%)`,
  transform: 'translateX(-50%)',
  cursor: 'ew-resize',
  touchAction: 'none',
  boxShadow: '0 0 0 0 transparent',
  transition: 'box-shadow 0.1s, opacity 0.1s, transform 0.1s',
  selectors: {
    [`${axisSwapped} &`]: {
      top: 'auto',
      left: '4px',
      transform: 'translateY(-50%)',
      cursor: 'ns-resize',
    },
  },
});

export const focused = style({
  boxShadow: `0 0 0 2px ${vars.color.accent}`,
});

export const pendingDeleteStop = style({
  opacity: 0.55,
  transform: 'translateX(-50%) scale(0.75)',
  borderColor: '#f44',
  cursor: 'no-drop',
  selectors: {
    [`${axisSwapped} &`]: {
      transform: 'translateY(-50%) scale(0.75)',
    },
  },
});

export const rightCol = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  overflow: 'hidden',
});

export const rampSection = style({
  display: 'flex',
  flexDirection: 'column',
  flex: '0 0 auto',
  borderBottom: `1px solid ${vars.color.line}`,
  padding: '12px 16px',
  gap: '8px',
  maxHeight: '50%',
  overflow: 'auto',
});

export const sectionHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
});

export const sectionHeaderActions = style({
  display: 'flex',
  alignItems: 'stretch',
  gap: '8px',
  flexShrink: 0,
});

export const kebabMenu = style({
  minWidth: '180px',
  zIndex: 220,
});

export const sectionLabel = style({
  fontSize: '11px',
  fontWeight: 600,
  color: vars.color.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
});

export const rampList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
});

export const rampDropIndicator = style({
  height: '2px',
  background: vars.color.accent,
  borderRadius: '1px',
  margin: '0 8px',
  boxShadow: `0 0 4px color-mix(in srgb, ${vars.color.accent}, transparent 50%)`,
});

export const rampRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '5px 8px',
  borderRadius: '6px',
  cursor: 'pointer',
  border: '1px solid transparent',
  transition: 'background 0.1s, opacity 0.1s',
  userSelect: 'none',
  selectors: {
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.05)',
    },
  },
});

export const rampRowSelected = style({
  borderColor: vars.color.accent,
  background: 'rgba(122, 182, 255, 0.08)',
});

export const rampRowDragging = style({
  opacity: 0.35,
  pointerEvents: 'none',
});

export const rampSwatch = style({
  width: '48px',
  height: '14px',
  borderRadius: '3px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  flexShrink: 0,
});

export const rampY = style({
  fontSize: '11px',
  color: vars.color.text,
  fontVariantNumeric: 'tabular-nums',
  flex: 1,
});

export const rampPositionEditor = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 2px 2px',
});

export const stopSection = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  overflow: 'auto',
  padding: '12px 16px',
  gap: '8px',
});

export const stopPreviewArea = style({
  flexShrink: 0,
});

export const stopPreview = style({
  position: 'relative',
  width: '100%',
  height: '18px',
  borderRadius: '4px',
  border: `1px solid ${vars.color.controlBorder}`,
  overflow: 'visible',
  margin: '14px 0',
});

export const previewStopKnob = style({
  position: 'absolute',
  width: '12px',
  height: '12px',
  borderRadius: '50%',
  border: '2px solid rgba(0, 0, 0, 0.3)',
  transform: 'translateX(-50%)',
  cursor: 'ew-resize',
  touchAction: 'none',
  transition: 'box-shadow 0.1s',
  top: 'calc(100% + 3px)',
});

export const above = style({
  top: 'auto',
  bottom: 'calc(100% + 3px)',
});

export const stopEditor = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
});

export const stopEditorField = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

export const stopEditorLabel = style({
  fontSize: '11px',
  color: vars.color.muted,
  minWidth: '52px',
  flexShrink: 0,
});

export const stopEditorUnit = style({
  fontSize: '11px',
  color: vars.color.muted,
  fontVariantNumeric: 'tabular-nums',
  minWidth: '34px',
});

export const posInput = style({
  width: 'calc(6ch + 16px)',
  boxSizing: 'content-box',
  fontSize: '12px',
  padding: '3px 6px',
  border: `1px solid ${vars.color.controlBorder}`,
  borderRadius: '4px',
  background: vars.color.surfaceInset,
  color: vars.color.text,
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right',
  selectors: {
    '&:disabled': {
      opacity: 0.4,
      cursor: 'not-allowed',
    },
  },
});

export const stopEditorActions = style({
  display: 'flex',
  gap: '8px',
  alignItems: 'stretch',
  flexWrap: 'wrap',
});

export const stopColorInput = style({
  width: '32px',
  height: '22px',
  padding: 0,
  border: 'none',
  borderRadius: '3px',
  cursor: 'pointer',
  background: 'none',
});

export const stopAlphaInput = style({
  width: '100%',
  height: '4px',
  accentColor: vars.color.accent,
});

export const noRamp = style({
  fontSize: '12px',
  color: vars.color.muted,
  padding: '12px 0',
});

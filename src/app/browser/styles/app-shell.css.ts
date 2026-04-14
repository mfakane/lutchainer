import { globalStyle } from '@vanilla-extract/css';
import { vars } from './app-theme.css.ts';

globalStyle('.app', {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  overflow: 'hidden',
});

globalStyle('.header', {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '10px 14px',
  background: `color-mix(in srgb, ${vars.color.panel}, #000 14%)`,
  borderBottom: `1px solid ${vars.color.line}`,
  flexWrap: 'wrap',
});

globalStyle('.header-title', {
  fontSize: '14px',
  fontWeight: 700,
  letterSpacing: '0.5em',
  color: '#eef3ff',
  whiteSpace: 'nowrap',
  textTransform: 'uppercase',
});

globalStyle('.header-title-wrap', {
  display: 'inline-flex',
  alignItems: 'baseline',
  minWidth: 0,
});

globalStyle('.header-title span', {
  color: vars.color.accent,
});

globalStyle('.header-build-commit', {
  fontSize: '0.6em',
  fontWeight: 600,
  letterSpacing: '0.16em',
  color: vars.color.muted,
  whiteSpace: 'nowrap',
  opacity: 0.9,
});

globalStyle('.action-group', {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginLeft: 'auto',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
});

globalStyle('.main', {
  display: 'flex',
  flex: 1,
  minHeight: 0,
});

globalStyle('.pipeline-panel', {
  width: 'calc(100% - 320px)',
  minWidth: '520px',
  maxWidth: 'calc(100% - 320px)',
  display: 'flex',
  flexDirection: 'column',
  background: `color-mix(in srgb, ${vars.color.panel}, #000 6%)`,
  borderRight: `1px solid ${vars.color.line}`,
  minHeight: 0,
});

globalStyle('.pipeline-header, .preview-header', {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '8px',
  padding: '10px 12px',
  borderBottom: `1px solid ${vars.color.line}`,
  background: `color-mix(in srgb, ${vars.color.panel2}, #000 6%)`,
});

globalStyle('.pipeline-title', {
  fontSize: '13px',
  fontWeight: 700,
  color: vars.color.textStrong,
});

globalStyle('.pipeline-help, .preview-help', {
  fontSize: '11px',
  color: vars.color.muted,
});

globalStyle('.pipeline-workspace', {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: '250px minmax(0, 1fr)',
  columnGap: '42px',
  minHeight: 0,
  position: 'relative',
});

globalStyle('.param-column', {
  position: 'relative',
  zIndex: 3,
  borderRight: `1px solid ${vars.color.line}`,
  padding: '12px',
  overflow: 'auto',
  background: `color-mix(in srgb, ${vars.color.panel2}, #000 12%)`,
});

globalStyle('.param-node-list', {
  marginTop: '10px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
});

globalStyle('.step-column', {
  position: 'relative',
  zIndex: 3,
  minHeight: 0,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
});

globalStyle('.connection-layer', {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 6,
});

globalStyle('.connection-path', {
  fill: 'none',
  stroke: 'var(--connection-color, #89bbff)',
  strokeWidth: 2,
  strokeLinecap: 'round',
  opacity: 0.8,
});

globalStyle('.connection-path-preview', {
  stroke: 'var(--connection-color, #cfe2ff)',
  strokeDasharray: '6 6',
  opacity: 0.95,
});

globalStyle('.statusbar', {
  borderTop: `1px solid ${vars.color.line}`,
});

globalStyle('.resizer', {
  width: '6px',
  cursor: 'col-resize',
  background: `linear-gradient(to bottom, transparent, ${vars.color.resizerLine}, transparent)`,
  flexShrink: 0,
});

globalStyle('.resizer.dragging', {
  background: vars.color.resizerActive,
});

globalStyle('.preview-panel', {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: `color-mix(in srgb, ${vars.color.panel}, #000 14%)`,
});

globalStyle('.preview-display-section', {
  display: 'flex',
  flexDirection: 'column',
  flex: '0 0 360px',
  minHeight: '190px',
  maxHeight: 'calc(100% - 170px)',
});

globalStyle('.preview-layout-resizer', {
  height: '6px',
  cursor: 'row-resize',
  flexShrink: 0,
  background: `linear-gradient(to right, transparent, ${vars.color.resizerLine}, transparent)`,
});

globalStyle('.preview-layout-resizer.dragging', {
  background: vars.color.resizerActive,
});

globalStyle('.preview-settings-scroll', {
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
  display: 'flex',
  flexDirection: 'column',
});

globalStyle('.material-panel', {
  borderTop: `1px solid ${vars.color.line}`,
  background: [
    'linear-gradient(180deg, rgba(122, 182, 255, 0.06), transparent 55%)',
    `color-mix(in srgb, ${vars.color.panel2}, #000 8%)`,
  ].join(', '),
  padding: '10px 12px 12px',
});

globalStyle('.light-panel', {
  borderTop: `1px solid ${vars.color.line}`,
  borderBottom: `1px solid ${vars.color.line}`,
  background: `color-mix(in srgb, ${vars.color.panel2}, #000 10%)`,
  padding: '10px 12px 12px',
});

globalStyle('.preview-canvas-wrap', {
  position: 'relative',
  flex: '1 1 auto',
  minHeight: 0,
});

globalStyle('.preview-shape-bar', {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: '8px',
  padding: '10px 12px',
  borderTop: `1px solid ${vars.color.line}`,
  borderBottom: 'none',
  background: `color-mix(in srgb, ${vars.color.panel2}, #000 10%)`,
});

globalStyle('#gl-canvas', {
  width: '100%',
  height: '100%',
  minHeight: 0,
  display: 'block',
  cursor: 'grab',
});

globalStyle('#gl-canvas:active', {
  cursor: 'grabbing',
});

globalStyle('.light-gizmo-layer', {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
});

globalStyle('.light-gizmo-layer #light-gizmo-arrow path', {
  fill: vars.color.lightGizmoMain,
});

globalStyle('.light-gizmo-origin', {
  fill: '#ffe7a6',
  opacity: 0.95,
});

globalStyle('.light-gizmo-tip', {
  fill: vars.color.lightGizmoMain,
  stroke: '#ffe8b5',
  strokeWidth: 1,
});

globalStyle('.light-gizmo-label', {
  fill: '#fff1cf',
  fontFamily: vars.font.sans,
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  paintOrder: 'stroke',
  stroke: 'rgba(45, 30, 0, 0.65)',
  strokeWidth: '2.4px',
  strokeLinejoin: 'round',
});

globalStyle('.axis-gizmo-layer', {
  position: 'absolute',
  left: '10px',
  top: '10px',
  width: '92px',
  height: '92px',
  pointerEvents: 'none',
  overflow: 'visible',
});

globalStyle('.axis-gizmo-back', {
  fill: 'rgba(12, 16, 22, 0.62)',
  stroke: 'rgba(151, 170, 204, 0.3)',
  strokeWidth: 1,
});

globalStyle('.axis-gizmo-line', {
  fill: 'none',
  strokeWidth: 2.1,
  strokeLinecap: 'round',
});

globalStyle('.axis-gizmo-line-x', {
  stroke: vars.color.axisX,
});

globalStyle('.axis-gizmo-line-y', {
  stroke: vars.color.axisY,
});

globalStyle('.axis-gizmo-line-z', {
  stroke: vars.color.axisZ,
});

globalStyle('.axis-gizmo-origin', {
  fill: '#e6edf9',
});

globalStyle('.axis-gizmo-tip', {
  strokeWidth: 1,
});

globalStyle('.axis-gizmo-tip-x', {
  fill: vars.color.axisX,
  stroke: '#ffd3cf',
});

globalStyle('.axis-gizmo-tip-y', {
  fill: vars.color.axisY,
  stroke: '#d8ffda',
});

globalStyle('.axis-gizmo-tip-z', {
  fill: vars.color.axisZ,
  stroke: '#d7eaff',
});

globalStyle('.axis-gizmo-label', {
  fontFamily: vars.font.sans,
  fontSize: '10px',
  fontWeight: 700,
  textAnchor: 'middle',
  dominantBaseline: 'middle',
  paintOrder: 'stroke',
  stroke: 'rgba(12, 16, 22, 0.78)',
  strokeWidth: '2.6px',
  strokeLinejoin: 'round',
});

globalStyle('.axis-gizmo-label-x', {
  fill: '#ffc1ba',
});

globalStyle('.axis-gizmo-label-y', {
  fill: '#d2ffd4',
});

globalStyle('.axis-gizmo-label-z', {
  fill: '#c4e0ff',
});

globalStyle('.shader-dialog, .lut-editor-dialog', {
  margin: 'auto',
  maxHeight: 'calc(100vh - 28px)',
  border: 'none',
  padding: 0,
  background: 'transparent',
  color: vars.color.text,
});

globalStyle('.shader-dialog', {
  width: 'min(980px, calc(100vw - 28px))',
  overflow: 'hidden',
});

globalStyle('.shader-dialog::backdrop, .lut-editor-dialog::backdrop', {
  background: 'rgba(8, 11, 16, 0.72)',
  backdropFilter: 'blur(2px)',
});

globalStyle('.pipeline-file-drop-overlay', {
  position: 'fixed',
  inset: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  background: 'rgba(7, 10, 16, 0.3)',
  backdropFilter: 'blur(6px)',
  opacity: 0,
  visibility: 'hidden',
  pointerEvents: 'none',
  transition: 'opacity 140ms ease, visibility 140ms ease',
  zIndex: 120,
});

globalStyle('.pipeline-file-drop-overlay[data-active="true"]', {
  opacity: 1,
  visibility: 'visible',
});

globalStyle('.pipeline-file-drop-overlay-card', {
  width: 'min(560px, calc(100vw - 48px))',
  borderRadius: '22px',
  border: `1px solid color-mix(in srgb, ${vars.color.accent}, #fff 18%)`,
  padding: '28px 32px',
  textAlign: 'center',
  background: [
    'radial-gradient(circle at top, rgba(122, 182, 255, 0.22), transparent 58%)',
    'linear-gradient(180deg, rgba(9, 14, 24, 0.96), rgba(13, 20, 31, 0.92))',
  ].join(', '),
  boxShadow: '0 28px 60px rgba(0, 0, 0, 0.38)',
  outline: `2px dashed color-mix(in srgb, ${vars.color.accent}, #fff 28%)`,
  outlineOffset: '-10px',
});

globalStyle('.pipeline-file-drop-overlay-title', {
  fontFamily: vars.font.sans,
  fontSize: 'clamp(24px, 3.6vw, 34px)',
  fontWeight: 700,
  letterSpacing: '0.06em',
  color: '#f5f8ff',
});

globalStyle('.pipeline-file-drop-overlay-description', {
  marginTop: '10px',
  fontSize: '14px',
  lineHeight: 1.6,
  color: vars.color.muted,
});

globalStyle('.lut-strip-panel', {
  position: 'relative',
});

globalStyle('.lut-file-drop-overlay', {
  position: 'absolute',
  inset: '10px 12px 12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
  borderRadius: '18px',
  background: 'rgba(10, 16, 27, 0.72)',
  backdropFilter: 'blur(4px)',
  opacity: 0,
  visibility: 'hidden',
  pointerEvents: 'none',
  transition: 'opacity 140ms ease, visibility 140ms ease',
  zIndex: 4,
});

globalStyle('.lut-file-drop-overlay[data-active="true"]', {
  opacity: 1,
  visibility: 'visible',
});

globalStyle('.lut-file-drop-overlay-card', {
  width: 'min(420px, 100%)',
  borderRadius: '16px',
  border: `1px solid color-mix(in srgb, ${vars.color.accent}, #fff 18%)`,
  padding: '20px 22px',
  textAlign: 'center',
  background: 'linear-gradient(180deg, rgba(18, 28, 45, 0.94), rgba(12, 19, 31, 0.92))',
  boxShadow: '0 18px 34px rgba(0, 0, 0, 0.28)',
  outline: `2px dashed color-mix(in srgb, ${vars.color.accent}, #fff 24%)`,
  outlineOffset: '-8px',
});

globalStyle('.lut-file-drop-overlay-title', {
  fontFamily: vars.font.sans,
  fontSize: '18px',
  fontWeight: 700,
  letterSpacing: '0.03em',
  color: '#f5f8ff',
});

globalStyle('.lut-file-drop-overlay-description', {
  marginTop: '8px',
  fontSize: '13px',
  lineHeight: 1.55,
  color: vars.color.muted,
});

globalStyle('.shader-dialog-surface, .lut-editor-dialog-surface', {
  display: 'flex',
  flexDirection: 'column',
  border: `1px solid ${vars.color.line}`,
  borderRadius: '14px',
  overflow: 'hidden',
  background: [
    'linear-gradient(180deg, rgba(122, 182, 255, 0.07), transparent 45%)',
    `color-mix(in srgb, ${vars.color.panel2}, #000 14%)`,
  ].join(', '),
  boxShadow: '0 24px 56px rgba(0, 0, 0, 0.5)',
});

globalStyle('.shader-dialog-surface', {
  minHeight: 0,
  height: 'min(74vh, 720px)',
  maxHeight: 'calc(100vh - 28px)',
});

globalStyle('.lut-strip-panel', {
  flex: '0 0 auto',
  borderTop: `1px solid ${vars.color.line}`,
  background: [
    `linear-gradient(180deg, ${vars.color.bg2}, ${vars.color.bg} 55%)`,
    `color-mix(in srgb, ${vars.color.panel}, #000 12%)`,
  ].join(', '),
  paddingTop: '10px',
});

globalStyle('.lut-strip-head', {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  marginBottom: '8px',
  paddingLeft: '12px',
});

globalStyle('.lut-strip-list', {
  display: 'flex',
});

globalStyle('.lut-editor-dialog', {
  width: 'min(860px, calc(100vw - 28px))',
});

globalStyle('.lut-editor-dialog-surface', {
  height: 'min(80vh, 680px)',
});

globalStyle('.pipeline-panel', {
  '@media': {
    'screen and (max-width: 1180px)': {
      minWidth: '430px',
    },
  },
});

globalStyle('.main', {
  '@media': {
    'screen and (max-width: 900px)': {
      flexDirection: 'column',
    },
  },
});

globalStyle('.pipeline-panel', {
  '@media': {
    'screen and (max-width: 900px)': {
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      minHeight: '55%',
    },
  },
});

globalStyle('.resizer', {
  '@media': {
    'screen and (max-width: 900px)': {
      width: '100%',
      height: '6px',
      cursor: 'row-resize',
    },
  },
});

globalStyle('.pipeline-workspace', {
  '@media': {
    'screen and (max-width: 900px)': {
      gridTemplateColumns: '1fr',
      gridTemplateRows: '200px minmax(0, 1fr)',
      columnGap: 0,
      rowGap: '14px',
    },
  },
});

globalStyle('.preview-shape-bar', {
  '@media': {
    'screen and (max-width: 900px)': {
      flexDirection: 'column',
      alignItems: 'flex-start',
    },
  },
});

globalStyle('.preview-display-section', {
  '@media': {
    'screen and (max-width: 900px)': {
      flexBasis: '300px',
      minHeight: '170px',
      maxHeight: 'none',
    },
  },
});

globalStyle('.shader-dialog', {
  '@media': {
    'screen and (max-width: 900px)': {
      width: 'calc(100vw - 16px)',
      maxHeight: 'calc(100vh - 16px)',
    },
  },
});

globalStyle('.pipeline-file-drop-overlay', {
  '@media': {
    'screen and (max-width: 900px)': {
      inset: '10px',
      padding: '18px',
    },
  },
});

globalStyle('.pipeline-file-drop-overlay-card', {
  '@media': {
    'screen and (max-width: 900px)': {
      width: '100%',
      padding: '24px 20px',
      borderRadius: '18px',
    },
  },
});

globalStyle('.shader-dialog-surface', {
  '@media': {
    'screen and (max-width: 900px)': {
      minHeight: 0,
      height: 'min(82vh, 700px)',
      maxHeight: 'calc(100vh - 16px)',
    },
  },
});

globalStyle('.axis-gizmo-layer', {
  '@media': {
    'screen and (max-width: 900px)': {
      left: '8px',
      top: '8px',
      width: '82px',
      height: '82px',
    },
  },
});

globalStyle('.param-column', {
  '@media': {
    'screen and (max-width: 900px)': {
      borderRight: 'none',
      borderBottom: `1px solid ${vars.color.line}`,
    },
  },
});

globalStyle('.lut-strip-panel', {
  '@media': {
    'screen and (max-width: 900px)': {
      padding: '10px',
    },
  },
});

globalStyle('.lut-file-drop-overlay', {
  '@media': {
    'screen and (max-width: 900px)': {
      inset: '8px 10px 10px',
      padding: '12px',
    },
  },
});

globalStyle('.lut-strip-head', {
  '@media': {
    'screen and (max-width: 900px)': {
      flexWrap: 'wrap',
    },
  },
});

import { globalStyle, style } from '@vanilla-extract/css';
import { vars } from '../../styles/app-theme.css.ts';

export const paramRoot = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
});
// Anchor class for step list globalStyle selectors.
export const stepRoot = style({});
// Anchor class for LUT strip globalStyle selectors.
export const lutRoot = style({});
// Anchor class for preview canvas globalStyle selectors.
export const stepPreviewCanvas = style({});
export const welcomeLinkButton = style({
  textDecoration: 'none',
});
export const stepTitleInput = style({
  minWidth: 0,
  width: 'min(180px, 38vw)',
  color: vars.color.textStrong,
  fontSize: '12px',
  fontWeight: 700,
  padding: '4px 6px',
});

export const customParamInput = style({
  minWidth: 0,
  width: '100%',
  color: vars.color.textStrong,
  fontSize: '12px',
  fontWeight: 700,
  padding: '4px 6px',
});

export const socketButton = style({
  border: `1px solid ${vars.color.line}`,
  background: `color-mix(in srgb, ${vars.color.panel}, ${vars.color.bg} 10%)`,
  color: vars.color.text,
  cursor: 'pointer',
  transition: '120ms ease',
  selectors: {
    '&:hover': {
      borderColor: vars.color.accent,
      transform: 'translateY(-1px)',
    },
  },
});

export const lutMenu = style({
  zIndex: 200,
  minWidth: '110px',
});

export const tooltip = style({
  position: 'fixed',
  transform: 'translateY(-50%)',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  padding: '10px',
  borderRadius: '12px',
  border: `1px solid color-mix(in srgb, ${vars.color.line}, ${vars.color.textStrong} 12%)`,
  background: `color-mix(in srgb, ${vars.color.panel}, ${vars.color.bg} 18%)`,
  boxShadow: `0 12px 28px color-mix(in srgb, ${vars.color.bg}, transparent 72%)`,
  zIndex: 20,
  pointerEvents: 'none',
});

export const tooltipLabel = style({
  fontSize: '10px',
  lineHeight: 1.2,
  letterSpacing: '0.04em',
  color: vars.color.muted,
});

export const tooltipCanvas = style({
  width: '112px',
  height: '112px',
  display: 'block',
  borderRadius: '8px',
  background: `radial-gradient(circle at 50% 42%, color-mix(in srgb, ${vars.color.textStrong}, transparent 88%), transparent 58%), color-mix(in srgb, ${vars.color.panel}, ${vars.color.bg} 32%)`,
});

globalStyle(`${paramRoot} [data-param-group]`, {
  border: `1px solid ${vars.color.line}`,
  borderRadius: '14px',
  padding: '10px',
  background: `color-mix(in srgb, ${vars.color.panel}, ${vars.color.bg} 12%)`,
});

globalStyle(`${paramRoot} [data-param-group-tone="feedback"]`, {
  borderColor: vars.color.feedbackBorder,
  background: `linear-gradient(180deg, color-mix(in srgb, ${vars.color.accent}, transparent 92%), color-mix(in srgb, ${vars.color.accent}, transparent 98%)), color-mix(in srgb, ${vars.color.panel}, ${vars.color.bg} 8%)`,
  boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${vars.color.accent}, transparent 92%)`,
});

globalStyle(`${paramRoot} [data-part="param-group-head"]`, {
  marginBottom: '8px',
});

globalStyle(`${paramRoot} [data-part="param-group-title-row"]`, {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  justifyContent: 'space-between',
});

globalStyle(`${paramRoot} [data-part="param-group-title"]`, {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: vars.color.textStrong,
});

globalStyle(`${paramRoot} [data-part="param-group-badge"]`, {
  display: 'inline-flex',
  alignItems: 'center',
  height: '20px',
  padding: '0 8px',
  borderRadius: '999px',
  border: `1px solid ${vars.color.feedbackBadgeBorder}`,
  background: vars.color.feedbackBadgeBg,
  color: vars.color.feedbackBadgeText,
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.04em',
});

globalStyle(`${paramRoot} [data-part="param-group-desc"]`, {
  marginTop: '4px',
  fontSize: '11px',
  lineHeight: 1.45,
  color: vars.color.muted,
});

globalStyle(`${paramRoot} [data-part="param-group-nodes"]`, {
  display: 'flex',
  flexDirection: 'column',
  gap: '9px',
});

globalStyle(`${paramRoot} [data-param-socket="true"]`, {
  position: 'relative',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '3px',
  textAlign: 'left',
  background: `color-mix(in srgb, ${vars.color.panel}, ${vars.color.bg} 10%)`,
  border: `1px solid ${vars.color.line}`,
  borderRadius: '10px',
  padding: '10px 34px 10px 10px',
  minHeight: '54px',
  cursor: 'pointer',
  userSelect: 'none',
  transition: '120ms ease',
});

globalStyle(`${paramRoot} [data-param-socket="true"]:hover, ${paramRoot} [data-param-socket="true"]:focus-visible`, {
  borderColor: vars.color.accent,
  transform: 'translateY(-1px)',
});

globalStyle(`${paramRoot} [data-custom-param-item="true"]`, {
  gap: '8px',
  alignItems: 'stretch',
  cursor: 'grab',
  paddingRight: '10px',
});

globalStyle(`${paramRoot} [data-custom-param-item="true"][data-dragging="true"]`, {
  opacity: 0.42,
});

globalStyle(`${paramRoot} [data-custom-param-item="true"][data-drop-position="before"]`, {
  boxShadow: `inset 0 3px 0 ${vars.color.accent}`,
});

globalStyle(`${paramRoot} [data-custom-param-item="true"][data-drop-position="after"]`, {
  boxShadow: `inset 0 -3px 0 ${vars.color.accent}`,
});

globalStyle(`${paramRoot} [data-part="custom-param-header"], ${paramRoot} [data-part="custom-param-slider-row"]`, {
  display: 'grid',
  alignItems: 'center',
  gridTemplateColumns: 'auto 1fr auto',
  gap: '4px',
  width: '100%',
  minWidth: 0,
});

globalStyle(`${paramRoot} [data-custom-param-handle="true"]`, {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'stretch',
  padding: 0,
  minWidth: '8px',
  border: 'none',
  color: vars.color.muted,
  cursor: 'grab',
  background: 'transparent',
});

globalStyle(`${paramRoot} [data-custom-param-handle="true"]:active`, {
  cursor: 'grabbing',
});

globalStyle(`${paramRoot} [data-part="custom-param-grip"]`, {
  width: '8px',
  height: '18px',
  opacity: 0.9,
  backgroundImage: [
    'radial-gradient(circle, currentColor 1.1px, transparent 1.2px)',
    'radial-gradient(circle, currentColor 1.1px, transparent 1.2px)',
  ].join(', '),
  backgroundPosition: '0 0, 4px 0',
  backgroundSize: '4px 6px',
  backgroundRepeat: 'repeat-y',
});

globalStyle(`${paramRoot} [data-part="socket-dot"], ${stepRoot} [data-part="socket-dot"]`, {
  position: 'absolute',
  top: '50%',
  width: '10px',
  height: '10px',
  borderRadius: '50%',
  border: `2px solid ${vars.color.socketBorder}`,
  background: vars.color.socketBg,
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
  right: '8px',
});

globalStyle(`${paramRoot} [data-param-socket="true"][data-socket-target="true"], ${stepRoot} [data-step-socket="true"][data-socket-target="true"]`, {
  borderColor: vars.color.socketTargetBorder,
  boxShadow: `0 0 0 3px ${vars.color.accentRingStrong}`,
});

globalStyle(`${paramRoot} [data-param-socket="true"][data-socket-source-active="true"], ${stepRoot} [data-step-socket="true"][data-socket-source-active="true"]`, {
  borderColor: vars.color.accent,
  boxShadow: `0 0 0 3px ${vars.color.accentRing}`,
});

globalStyle(`${paramRoot} [data-part="param-name"]`, {
  fontSize: '12px',
  fontWeight: 700,
  color: vars.color.textStrong,
});

globalStyle(`${paramRoot} [data-part="param-desc"]`, {
  fontSize: '11px',
  color: vars.color.muted,
});

globalStyle(`${paramRoot} [data-part="custom-param-meta"]`, {
  display: 'flex',
  minWidth: 0,
});

globalStyle(`${paramRoot} [data-part="custom-param-value"]`, {
  flex: '0 0 auto',
  minWidth: '2.8em',
  textAlign: 'right',
  fontFamily: vars.font.mono,
  fontSize: '11px',
  color: vars.color.muted,
});

globalStyle(`${stepRoot}`, {
  position: 'relative',
  zIndex: 4,
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  padding: '12px 12px 12px 0',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
});

globalStyle(`${stepRoot} [data-step-empty="true"]`, {
  minWidth: 0,
  border: `1px solid ${vars.color.panelBorderStrong}`,
  borderRadius: '14px',
  padding: '18px',
  background: `linear-gradient(180deg, color-mix(in srgb, ${vars.color.panel2}, ${vars.color.bg} 2%), color-mix(in srgb, ${vars.color.panel}, ${vars.color.bg} 10%))`,
  display: 'grid',
  gap: '14px',
});

globalStyle(`${stepRoot} [data-part="welcome-eyebrow"]`, {
  fontSize: '10px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: vars.color.accent,
  fontWeight: 700,
});

globalStyle(`${stepRoot} [data-part="welcome-title"]`, {
  margin: 0,
  fontSize: '24px',
  lineHeight: 1.1,
  color: vars.color.textStrong,
});

globalStyle(`${stepRoot} [data-part="welcome-copy"], ${stepRoot} [data-part="welcome-step-hint"]`, {
  margin: 0,
  fontSize: '13px',
  lineHeight: 1.6,
  color: vars.color.text,
});

globalStyle(`${stepRoot} [data-part="welcome-actions"]`, {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
});

globalStyle(`${stepRoot} [data-part="welcome-examples"]`, {
  paddingTop: '8px',
  borderTop: `1px solid color-mix(in srgb, ${vars.color.line}, transparent 30%)`,
});

globalStyle(`${stepRoot} [data-part="welcome-section-title"]`, {
  fontSize: '11px',
  fontWeight: 700,
  color: vars.color.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '8px',
});

globalStyle(`${stepRoot} [data-part="welcome-example-list"]`, {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
});

globalStyle(`${stepRoot} [data-step-item="true"]`, {
  display: 'grid',
  gridTemplateRows: 'auto auto',
  gridTemplateColumns: '10ch minmax(0, 1fr) 120px',
  gap: '10px',
  border: `1px solid ${vars.color.line}`,
  borderRadius: '12px',
  padding: '8px',
  background: `color-mix(in srgb, ${vars.color.panel2}, ${vars.color.bg} 5%)`,
});

globalStyle(`${stepRoot} [data-step-item="true"][data-muted="true"]`, {
  borderColor: `color-mix(in srgb, ${vars.color.line}, ${vars.color.warn} 22%)`,
  background: `color-mix(in srgb, ${vars.color.panel2}, ${vars.color.warn} 4%)`,
});

globalStyle(`${stepRoot} [data-step-item="true"][data-dragging="true"]`, {
  opacity: 0.42,
});

globalStyle(`${stepRoot} [data-step-item="true"][data-drop-position="before"]`, {
  boxShadow: `inset 0 3px 0 ${vars.color.accent}`,
});

globalStyle(`${stepRoot} [data-step-item="true"][data-drop-position="after"]`, {
  boxShadow: `inset 0 -3px 0 ${vars.color.accent}`,
});

globalStyle(`${stepRoot} [data-part="step-head"]`, {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '8px',
  gridColumn: '1 / -1',
});

globalStyle(`${stepRoot} [data-part="step-title-row"]`, {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  minWidth: 0,
});

globalStyle(`${stepRoot} [data-step-drag-handle="true"]`, {
  padding: '4px 7px',
  minWidth: 0,
  fontSize: '10px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: vars.color.muted,
  cursor: 'grab',
  background: 'transparent',
  border: `1px solid ${vars.color.line}`,
  borderRadius: '8px',
});

globalStyle(`${stepRoot} [data-step-drag-handle="true"]:active`, {
  cursor: 'grabbing',
});

globalStyle(`${stepRoot} [data-part="step-actions"]`, {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '6px',
  flexWrap: 'wrap',
});

globalStyle(`${stepRoot} [data-part="step-socket-rail"]`, {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '8px',
});

globalStyle(`${stepRoot} [data-step-socket="true"]`, {
  position: 'relative',
  textAlign: 'left',
  minHeight: '58px',
  padding: '8px 8px 8px 26px',
  fontSize: '11px',
  lineHeight: 1.2,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '4px',
  border: `1px solid ${vars.color.line}`,
  borderRadius: '10px',
  background: `color-mix(in srgb, ${vars.color.panel}, ${vars.color.bg} 10%)`,
});

globalStyle(`${stepRoot} [data-step-socket="true"] [data-part="socket-dot"]`, {
  left: '8px',
  right: 'auto',
});

globalStyle(`${stepRoot} [data-part="step-socket-axis-label"]`, {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  color: vars.color.stepSocketAxis,
});

globalStyle(`${stepRoot} [data-part="step-socket-param"]`, {
  fontSize: '10px',
  color: vars.color.text,
});

globalStyle(`${stepRoot} [data-part="step-core"]`, {
  minWidth: 0,
  border: `1px solid ${vars.color.panelBorderStrong}`,
  borderRadius: '10px',
  padding: '8px',
  background: `color-mix(in srgb, ${vars.color.panel}, ${vars.color.bg} 8%)`,
});

globalStyle(`${stepRoot} [data-part="lut-row"]`, {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 72px',
  gap: '8px',
  marginBottom: '8px',
  alignItems: 'center',
});

globalStyle(`${stepRoot} [data-part="lut-select-field"], ${stepRoot} [data-part="step-mode-field"]`, {
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
});

globalStyle(`${stepRoot} [data-part="lut-select-label"], ${stepRoot} [data-part="op-label"]`, {
  fontSize: '10px',
  color: vars.color.muted,
});

globalStyle(`${stepRoot} [data-part="lut-thumb-wrap"]`, {
  position: 'relative',
  width: '72px',
  height: '72px',
  flexShrink: 0,
});

globalStyle(`${stepRoot} [data-part="lut-thumb"]`, {
  width: '100%',
  height: '100%',
  aspectRatio: '1 / 1',
  objectFit: 'cover',
  border: `1px solid ${vars.color.panelBorderStrong}`,
});

globalStyle(`${stepRoot} [data-part="lut-crosshair"]`, {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  borderRadius: '8px',
  overflow: 'hidden',
});

globalStyle(`${stepRoot} [data-part="lut-crosshair"]::before, ${stepRoot} [data-part="lut-crosshair"]::after`, {
  content: '',
  position: 'absolute',
});

globalStyle(`${stepRoot} [data-part="lut-crosshair"]::before`, {
  left: 0,
  right: 0,
  top: 'var(--ch-y, 50%)',
  height: '1px',
  borderTop: `1px dashed ${vars.color.crosshairDash}`,
  background: vars.color.crosshairShade,
});

globalStyle(`${stepRoot} [data-part="lut-crosshair"]::after`, {
  top: 0,
  bottom: 0,
  left: 'var(--ch-x, 50%)',
  width: '1px',
  borderLeft: `1px dashed ${vars.color.crosshairDash}`,
  background: vars.color.crosshairShade,
});

globalStyle(`${stepRoot} [data-part="op-grid"]`, {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '6px',
});

globalStyle(`${stepRoot} [data-part="op-item"]`, {
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
});

globalStyle(`${stepRoot} [data-part="step-preview"]`, {
  border: `1px solid ${vars.color.panelBorderStrong}`,
  borderRadius: '10px',
  background: `color-mix(in srgb, ${vars.color.bg}, ${vars.color.bg3} 8%)`,
});

globalStyle(`${stepRoot} [data-part="preview-swatch"]`, {
  display: 'block',
  width: '100%',
  height: '100%',
  aspectRatio: '1 / 1',
  borderRadius: '10px',
  imageRendering: 'auto',
});

globalStyle(`${lutRoot}`, {
  display: 'flex',
  gap: '10px',
  overflowX: 'auto',
  overflowY: 'hidden',
  minHeight: '122px',
  padding: '12px',
  paddingTop: 0,
});

globalStyle(`${lutRoot} [data-lut-empty="true"]`, {
  width: '100%',
  minHeight: '92px',
  border: `1px dashed ${vars.color.panelBorderStrong}`,
  borderRadius: '12px',
  display: 'grid',
  placeItems: 'center',
  color: vars.color.muted,
  fontSize: '12px',
});

globalStyle(`${lutRoot} [data-lut-item="true"]`, {
  flex: '0 0 120px',
  aspectRatio: '1 / 1',
  border: `1px solid ${vars.color.panelBorderStrong}`,
  borderRadius: '12px',
  background: vars.color.surfaceInset,
  position: 'relative',
  cursor: 'grab',
});

globalStyle(`${lutRoot} [data-lut-item="true"][data-dragging="true"]`, {
  opacity: 0.42,
});

globalStyle(`${lutRoot} [data-lut-item="true"][data-drop-position="before"]`, {
  boxShadow: `-3px 0 0 ${vars.color.accent}`,
});

globalStyle(`${lutRoot} [data-lut-item="true"][data-drop-position="after"]`, {
  boxShadow: `3px 0 0 ${vars.color.accent}`,
});

globalStyle(`${lutRoot} [data-part="lut-thumb-wrap"]`, {
  position: 'absolute',
  inset: 0,
  borderRadius: 'inherit',
  overflow: 'hidden',
});

globalStyle(`${lutRoot} [data-part="lut-thumb"]`, {
  width: '100%',
  height: '100%',
  display: 'block',
  objectFit: 'cover',
});

globalStyle(`${lutRoot} [data-part="lut-meta"]`, {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gridTemplateRows: 'auto auto',
  gap: '2px',
  padding: '5px 7px',
  background: `color-mix(in srgb, ${vars.color.bg}, transparent 28%)`,
  backdropFilter: 'blur(3px)',
});

globalStyle(`${lutRoot} [data-part="lut-name"]`, {
  fontSize: '11px',
  lineHeight: 1.35,
  color: vars.color.textStrong,
  overflowWrap: 'anywhere',
  gridRow: '1',
  gridColumn: '1 / -1',
});

globalStyle(`${lutRoot} [data-part="lut-stats"]`, {
  fontSize: '10px',
  color: vars.color.muted,
  gridRow: '2',
});

globalStyle(`${lutRoot} [data-part="lut-actions"]`, {
  display: 'flex',
  gap: '4px',
  alignItems: 'stretch',
  justifyContent: 'flex-end',
  gridRow: '2',
  marginTop: 'auto',
});

globalStyle(`${lutRoot} [data-lut-remove="true"]`, {
  marginTop: 'auto',
  fontSize: '10px',
  padding: '4px 7px',
  color: vars.color.removeText,
  gridRow: '2',
  height: '16px',
  boxSizing: 'content-box',
});

globalStyle(`${lutRoot} [data-part="lut-add-item"]`, {
  flex: '0 0 120px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  cursor: 'default',
  aspectRatio: '1 / 1',
  border: `1px dashed ${vars.color.line}`,
  borderRadius: '12px',
  padding: 0,
  overflow: 'hidden',
});

globalStyle(`${lutRoot} [data-part="lut-add-new"], ${lutRoot} [data-part="lut-add-browse"]`, {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  color: vars.color.muted,
  padding: 0,
  fontSize: '12px',
  cursor: 'pointer',
  transition: '120ms ease',
});

globalStyle(`${lutRoot} [data-part="lut-add-new"]`, {
  flex: '2 0 0',
});

globalStyle(`${lutRoot} [data-part="lut-add-browse"]`, {
  flex: '1 0 0',
});

globalStyle(`${lutRoot} [data-part="lut-add-new"]:hover, ${lutRoot} [data-part="lut-add-browse"]:hover`, {
  color: vars.color.accent,
  background: `color-mix(in srgb, ${vars.color.surfaceInset}, ${vars.color.accent} 8%)`,
});

globalStyle(`${stepRoot} [data-step-item="true"]`, {
  '@media': {
    '(max-width: 1180px)': {
      gridTemplateColumns: '7ch minmax(0, 1fr) 90px',
      hyphens: 'auto',
    },
  },
});

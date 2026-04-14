import { globalStyle, style } from '@vanilla-extract/css';
import { vars } from './app-theme.css.ts';

export const checkerBg = style({
  backgroundColor: vars.color.checkerA,
  backgroundImage: [
    `linear-gradient(45deg, ${vars.color.checkerB} 25%, transparent 25%, transparent 75%, ${vars.color.checkerB} 75%)`,
    `linear-gradient(45deg, ${vars.color.checkerB} 25%, transparent 25%, transparent 75%, ${vars.color.checkerB} 75%)`,
  ].join(', '),
  backgroundSize: `${vars.size.checker} ${vars.size.checker}`,
  backgroundPosition: `0 0, calc(${vars.size.checker} / 2) calc(${vars.size.checker} / 2)`,
});

export const sectionLabel = style({
  fontSize: '11px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: vars.color.muted,
  fontWeight: 700,
});

globalStyle('.section-label', {
  fontSize: '11px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: vars.color.muted,
  fontWeight: 700,
});

export const buttonBase = style({
  border: `1px solid ${vars.color.line}`,
  background: vars.color.panel,
  borderRadius: '8px',
  padding: '6px 11px',
  fontSize: '12px',
  color: vars.color.text,
  cursor: 'pointer',
  transition: '120ms ease',
  selectors: {
    '&:hover': {
      borderColor: vars.color.accent,
      transform: 'translateY(-1px)',
    },
    '&:disabled, &:disabled:hover': {
      opacity: 0.45,
      cursor: 'not-allowed',
      borderColor: vars.color.line,
      transform: 'none',
    },
  },
});

globalStyle('button', {
  border: `1px solid ${vars.color.line}`,
  background: vars.color.panel,
  borderRadius: '8px',
  padding: '6px 11px',
  fontSize: '12px',
  color: vars.color.text,
  cursor: 'pointer',
  transition: '120ms ease',
});

globalStyle('button:hover', {
  borderColor: vars.color.accent,
  transform: 'translateY(-1px)',
});

globalStyle('button:disabled, button:disabled:hover', {
  opacity: 0.45,
  cursor: 'not-allowed',
  borderColor: vars.color.line,
  transform: 'none',
});

export const secondaryButton = style({
  color: vars.color.muted,
});

export const submitButton = style({
  borderColor: vars.color.accent,
  background: vars.color.accent,
  color: vars.color.accentInk,
  fontWeight: 700,
});

export const activeAccent = style({
  borderColor: vars.color.accent,
  background: vars.color.accent,
  color: vars.color.accentInk,
  fontWeight: 700,
});

export const inlineAddButton = style({
  width: '100%',
  border: `1px dashed ${vars.color.line}`,
  borderRadius: '12px',
  background: 'transparent',
  padding: '8px',
  transition: '120ms ease',
  selectors: {
    '&:hover': {
      transform: 'none',
      borderColor: vars.color.accent,
      background: `color-mix(in srgb, ${vars.color.surfaceInset}, ${vars.color.accent} 8%)`,
    },
  },
});

export const ghostButton = style({
  background: 'transparent',
});

export const smallActionButton = style({
  padding: '4px 8px',
  fontSize: '11px',
});

export const menuWrap = style({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
});

export const menuTrigger = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '30px',
  padding: '4px 8px',
  fontSize: '16px',
  lineHeight: 1,
  color: vars.color.textStrong,
  selectors: {
    '&[aria-expanded="true"]': {
      borderColor: vars.color.accent,
      background: `color-mix(in srgb, ${vars.color.panel}, ${vars.color.accent} 12%)`,
    },
  },
});

export const menu = style({
  position: 'absolute',
  right: 0,
  top: 'calc(100% + 8px)',
  minWidth: '248px',
  zIndex: 30,
  border: `1px solid ${vars.color.controlBorder}`,
  borderRadius: '10px',
  background: `color-mix(in srgb, ${vars.color.panel}, ${vars.color.bg} 8%)`,
  boxShadow: `0 14px 28px color-mix(in srgb, ${vars.color.bg}, transparent 64%)`,
  padding: '6px',
});

export const menuItem = style({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  border: 'none',
  borderRadius: '8px',
  background: 'transparent',
  padding: '8px 10px',
  fontSize: '12px',
  color: vars.color.text,
  selectors: {
    '&:hover': {
      transform: 'none',
      background: `color-mix(in srgb, ${vars.color.panel2}, ${vars.color.accent} 16%)`,
    },
    '&:active': {
      transform: 'none',
      background: `color-mix(in srgb, ${vars.color.panel2}, ${vars.color.accent} 24%)`,
    },
    '&:focus-visible': {
      outline: `1px solid ${vars.color.accent}`,
      outlineOffset: '1px',
    },
  },
});

export const menuHeader = style({
  padding: '8px 10px',
  fontSize: '11px',
  fontWeight: 700,
  color: vars.color.muted,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  borderBottom: `1px solid ${vars.color.line}`,
  marginBottom: '4px',
  marginTop: '4px',
});

globalStyle(`${menuHeader}:first-child`, {
  marginTop: 0,
});

export const symbolKebab = style({
  position: 'relative',
  display: 'inline-flex',
  justifyContent: 'center',
  fontSize: 0,
  alignItems: 'center',
  width: '20px',
  color: 'transparent',
});

globalStyle(`${symbolKebab}::before`, {
  display: 'inline-block',
  width: '20px',
  height: 0,
  borderTop: `4px dotted ${vars.color.textStrong}`,
  content: '',
});

export const controlSelect = style({
  width: '100%',
  border: `1px solid ${vars.color.controlBorder}`,
  borderRadius: '8px',
  background: vars.color.controlBg,
  color: vars.color.text,
  fontSize: '12px',
  padding: '6px 8px',
});

export const rangeInput = style({
  width: '100%',
  accentColor: vars.color.accent,
});

export const colorInput = style({
  width: '100%',
  height: '34px',
  border: `1px solid ${vars.color.controlBorder}`,
  borderRadius: '9px',
  background: vars.color.controlBg,
  padding: '4px',
});

export const editableTextInput = style({
  border: '1px solid transparent',
  borderRadius: '8px',
  background: 'transparent',
  selectors: {
    '&:hover': {
      borderColor: `color-mix(in srgb, ${vars.color.line}, ${vars.color.accent} 32%)`,
      background: `color-mix(in srgb, ${vars.color.panel}, ${vars.color.bg} 10%)`,
    },
    '&:focus': {
      outline: 'none',
      borderColor: vars.color.accent,
      background: `color-mix(in srgb, ${vars.color.panel}, ${vars.color.bg} 6%)`,
    },
  },
});

export const removeText = style({
  color: vars.color.removeText,
});

export const languageButton = style({
  width: '30px',
  height: '30px',
  minWidth: '30px',
  padding: 0,
  borderRadius: '50%',
  lineHeight: 1,
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'lowercase',
});

globalStyle('::-webkit-scrollbar', {
  width: '8px',
  height: '8px',
});

globalStyle('::-webkit-scrollbar-track', {
  background: 'transparent',
});

globalStyle('::-webkit-scrollbar-thumb', {
  background: vars.color.scrollbarThumb,
  borderRadius: '999px',
});

globalStyle('::-webkit-scrollbar-thumb:hover', {
  background: vars.color.scrollbarThumbHover,
});

import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../styles/app-theme.css.ts';

export const statusLog = style({
  padding: '9px 12px',
  fontFamily: vars.font.mono,
  fontSize: '11px',
  lineHeight: 1.45,
  minHeight: '36px',
  maxHeight: '120px',
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  background: vars.color.statusPanel,
});

export const statusTone = styleVariants({
  success: {
    color: vars.color.ok,
  },
  error: {
    color: `color-mix(in srgb, ${vars.color.warn}, ${vars.color.textStrong} 34%)`,
    background: `color-mix(in srgb, ${vars.color.warn}, ${vars.color.bg} 86%)`,
  },
  info: {
    color: `color-mix(in srgb, ${vars.color.muted}, ${vars.color.accent} 24%)`,
  },
});

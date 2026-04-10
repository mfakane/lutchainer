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
  background: '#14171d',
});

export const statusTone = styleVariants({
  success: {
    color: vars.color.ok,
  },
  error: {
    color: '#ffb8aa',
    background: '#261614',
  },
  info: {
    color: '#9daec7',
  },
});

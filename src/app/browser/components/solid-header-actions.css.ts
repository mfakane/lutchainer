import { style } from '@vanilla-extract/css';
import { vars } from '../styles/app-theme.css.ts';

export const autoLabel = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '12px',
  color: vars.color.muted,
});

export const languageSwitcher = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
});

export const shaderOpenButton = style({
  whiteSpace: 'nowrap',
});

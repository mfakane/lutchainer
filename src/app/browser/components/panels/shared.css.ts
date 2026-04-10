import { globalStyle, style } from '@vanilla-extract/css';
import { vars } from '../../styles/app-theme.css.ts';

export const panelRoot = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
});

export const panelHead = style({
  display: 'flex',
  justifyContent: 'space-between',
  gap: '8px',
  '@media': {
    '(max-width: 900px)': {
      flexDirection: 'column',
      alignItems: 'flex-start',
    },
  },
});

export const helpText = style({
  fontSize: '11px',
  color: vars.color.muted,
});

export const grid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '8px',
  '@media': {
    '(max-width: 1180px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const field = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  padding: '9px 10px',
  border: `1px solid ${vars.color.panelBorderStrong}`,
  borderRadius: '12px',
  background: `color-mix(in srgb, ${vars.color.panel}, #000 4%)`,
});

export const colorField = style({
  gridColumn: 'span 2',
  '@media': {
    '(max-width: 1180px)': {
      gridColumn: 'span 1',
    },
  },
});

export const labelRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
});

export const labelText = style({
  fontSize: '11px',
  fontWeight: 700,
  color: vars.color.textStrong,
});

export const valueText = style({
  fontFamily: vars.font.mono,
  fontSize: '11px',
  color: vars.color.muted,
});

export const lightActions = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  '@media': {
    '(max-width: 900px)': {
      width: '100%',
      justifyContent: 'space-between',
    },
  },
});

export const lightToggleButton = style({
  selectors: {
    '&[aria-pressed="true"]': {
      borderColor: vars.color.accent,
      color: '#d4e5ff',
    },
  },
});

globalStyle(`${lightActions} > *`, {
  flexShrink: 0,
});

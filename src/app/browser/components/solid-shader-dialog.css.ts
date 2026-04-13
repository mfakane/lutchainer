import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../styles/app-theme.css.ts';

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  height: '100%',
});

export const header = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '10px 12px',
  borderBottom: `1px solid ${vars.color.line}`,
  '@media': {
    '(max-width: 900px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const helpText = style({
  marginTop: '4px',
  fontSize: '11px',
  color: vars.color.muted,
});

export const tabs = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  marginLeft: 'auto',
  marginRight: 'auto',
  padding: '3px',
  border: `1px solid ${vars.color.panelBorderStrong}`,
  borderRadius: '999px',
  background: vars.color.tabPillBg,
});

export const tab = style({
  borderColor: 'transparent',
  background: 'transparent',
  borderRadius: '999px',
  padding: '4px 10px',
  fontSize: '11px',
  color: vars.color.muted,
  selectors: {
    '&:hover': {
      transform: 'none',
    },
  },
});

export const tabState = styleVariants({
  active: {
    borderColor: vars.color.accent,
    background: vars.color.accent,
    color: vars.color.accentInk,
  },
  inactive: {},
});

export const toolbar = style({
  display: 'flex',
  alignItems: 'stretch',
  gap: '8px',
  marginLeft: 'auto',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  '@media': {
    '(max-width: 900px)': {
      width: '100%',
      justifyContent: 'space-between',
    },
  },
});

export const meta = style({
  padding: '8px 12px',
  borderBottom: `1px solid ${vars.color.line}`,
  fontFamily: vars.font.mono,
  fontSize: '11px',
  color: vars.color.muted,
});

export const codeOutput = style({
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  padding: '12px',
  fontFamily: vars.font.mono,
  fontSize: '11px',
  lineHeight: 1.5,
  whiteSpace: 'pre',
  color: vars.color.codeText,
  userSelect: 'text',
});

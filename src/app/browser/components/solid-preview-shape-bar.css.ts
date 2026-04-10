import { style } from '@vanilla-extract/css';

export const root = style({
  display: 'contents',
});

export const shapeGroup = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
  justifyContent: 'flex-start',
  '@media': {
    '(max-width: 900px)': {
      width: '100%',
      justifyContent: 'flex-start',
    },
  },
});

export const actionMenuWrap = style({
  marginLeft: 'auto',
  '@media': {
    '(max-width: 900px)': {
      marginLeft: 'auto',
    },
  },
});

export const kebabMenu = style({
  '@media': {
    '(max-width: 900px)': {
      left: 0,
      right: 'auto',
      minWidth: 'min(280px, calc(100vw - 32px))',
    },
  },
});

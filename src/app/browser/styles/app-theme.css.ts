import { createGlobalTheme, globalStyle } from '@vanilla-extract/css';

export const vars = createGlobalTheme(':root', {
  color: {
    bg: '#111111',
    bg2: '#222222',
    bg3: '#333333',
    panel: '#202020',
    panel2: '#272727',
    text: '#dde2ea',
    textStrong: '#e1e8f8',
    muted: '#9aa3b2',
    accent: '#7ab6ff',
    accentInk: '#0c1420',
    controlBorder: '#515151',
    controlBg: '#1a1a1a',
    panelBorderStrong: '#464646',
    surfaceInset: '#171c25',
    line: '#414141',
    resizerLine: '#4b4b4b',
    resizerActive: '#4b4b4b',
    removeText: '#f8c2b8',
    socketBorder: '#9bb6dd',
    socketBg: '#1b1b1b',
    scrollbarThumb: '#4a4a4a',
    scrollbarThumbHover: '#5e5e5e',
    lightGizmoMain: '#ffd17a',
    axisX: '#ff8d84',
    axisY: '#90ec8f',
    axisZ: '#8dc4ff',
    warn: '#ef8f7a',
    ok: '#7adf9f',
    checkerA: '#808080',
    checkerB: '#666666',
  },
  size: {
    checker: '12px',
  },
  font: {
    sans: `'Avenir Next', 'Segoe UI', 'Hiragino Sans', sans-serif`,
    mono: `'SFMono-Regular', 'Consolas', monospace`,
  },
});

globalStyle('html, body', {
  height: '100%',
  margin: 0,
  padding: 0,
  fontFamily: vars.font.sans,
  color: vars.color.text,
  background: [
    'radial-gradient(circle at 12% 15%, #252525 0%, transparent 38%)',
    'radial-gradient(circle at 88% 82%, #444444 0%, transparent 42%)',
    vars.color.bg3,
  ].join(', '),
});

globalStyle('button, input, select, textarea', {
  font: 'inherit',
});

export interface LutListRow {
  id: string;
  name: string;
  size: string;
  file: string;
}

export interface StepListRow {
  id: string;
  label: string;
  lut: string;
  blend: string;
  x: string;
  y: string;
  muted: string;
}

export interface InfoSummaryRow {
  key: string;
  value: string;
}

function padCell(value: string, width: number): string {
  return value.padEnd(width, ' ');
}

function formatTable(headers: readonly string[], rows: ReadonlyArray<readonly string[]>): string {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map(row => row[index]?.length ?? 0)),
  );

  const formatRow = (row: readonly string[]): string =>
    row
      .map((cell, index) => padCell(cell, widths[index]))
      .join('  ')
      .trimEnd();

  return [
    formatRow(headers),
    ...rows.map(formatRow),
  ].join('\n');
}

export function formatLutList(rows: readonly LutListRow[]): string {
  return formatTable(
    ['ID', 'NAME', 'SIZE', 'FILE'],
    rows.map(row => [row.id, row.name, row.size, row.file]),
  );
}

export function formatStepList(rows: readonly StepListRow[]): string {
  return formatTable(
    ['ID', 'LABEL', 'LUT', 'BLEND', 'X', 'Y', 'MUTED'],
    rows.map(row => [row.id, row.label, row.lut, row.blend, row.x, row.y, row.muted]),
  );
}

export function formatInfoSummary(rows: readonly InfoSummaryRow[]): string {
  const keyWidth = Math.max(...rows.map(row => row.key.length)) + 1;
  return rows
    .map(row => `${padCell(row.key + ':', keyWidth)} ${row.value}`)
    .join('\n');
}

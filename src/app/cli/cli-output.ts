export interface LutListRow {
  id: string;
  name: string;
  size: string;
  file: string;
}

function padCell(value: string, width: number): string {
  return value.padEnd(width, ' ');
}

export function formatLutList(rows: readonly LutListRow[]): string {
  const headers: LutListRow = {
    id: 'ID',
    name: 'NAME',
    size: 'SIZE',
    file: 'FILE',
  };

  const idWidth = Math.max(headers.id.length, ...rows.map(row => row.id.length));
  const nameWidth = Math.max(headers.name.length, ...rows.map(row => row.name.length));
  const sizeWidth = Math.max(headers.size.length, ...rows.map(row => row.size.length));

  const formatRow = (row: LutListRow): string => [
    padCell(row.id, idWidth),
    padCell(row.name, nameWidth),
    padCell(row.size, sizeWidth),
    row.file,
  ].join('  ');

  return [
    formatRow(headers),
    ...rows.map(formatRow),
  ].join('\n');
}

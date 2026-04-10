export function cx(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
}

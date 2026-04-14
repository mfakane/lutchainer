import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const FEATURES_ROOT = path.resolve(process.cwd(), 'src/features');

const FORBIDDEN_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: 'document global', pattern: /\bdocument\b/ },
  { label: 'window global', pattern: /\bwindow\b/ },
  { label: 'navigator global', pattern: /\bnavigator\b/ },
  { label: 'Image constructor', pattern: /new\s+Image\s*\(/ },
  { label: 'object URL creation', pattern: /URL\.createObjectURL\s*\(/ },
  { label: 'object URL revocation', pattern: /URL\.revokeObjectURL\s*\(/ },
];

function collectSourceFiles(dirPath: string): string[] {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const filePaths: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      filePaths.push(...collectSourceFiles(entryPath));
      continue;
    }

    if (entry.isFile() && /\.(ts|tsx|mts)$/.test(entry.name)) {
      filePaths.push(entryPath);
    }
  }

  return filePaths;
}

function findViolations(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  const violations: string[] = [];

  for (const { label, pattern } of FORBIDDEN_PATTERNS) {
    if (pattern.test(source)) {
      violations.push(`${relativePath}: ${label}`);
    }
  }

  return violations;
}

test('features layer does not directly use browser globals', () => {
  const violations = collectSourceFiles(FEATURES_ROOT)
    .flatMap(findViolations)
    .sort((left, right) => left.localeCompare(right));

  assert.deepStrictEqual(
    violations,
    [],
    violations.length > 0
      ? `features boundary violations found:\n${violations.join('\n')}`
      : 'features boundary violations found',
  );
});
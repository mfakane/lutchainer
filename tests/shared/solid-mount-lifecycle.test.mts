import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function readSource(relativePath: string): string {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return readFileSync(absolutePath, 'utf8');
}

function assertPattern(source: string, pattern: RegExp, message: string): void {
  assert.ok(pattern.test(source), message);
}

test('header actions mount disposes previous active controller before remount', () => {
  const source = readSource('src/app/browser/components/solid-header-actions.tsx');

  assertPattern(
    source,
    /if\s*\(activeHeaderActionGroupController\)\s*\{[\s\S]*?activeHeaderActionGroupController\.dispose\(\);[\s\S]*?activeHeaderActionGroupController\s*=\s*null;[\s\S]*?\}/,
    'solid-header-actions should dispose and reset active controller before remount',
  );
});

test('preview shape bar mount disposes previous active controller before remount', () => {
  const source = readSource('src/app/browser/components/solid-preview-shape-bar.tsx');

  assertPattern(
    source,
    /if\s*\(activePreviewShapeBarController\)\s*\{[\s\S]*?activePreviewShapeBarController\.dispose\(\);[\s\S]*?activePreviewShapeBarController\s*=\s*null;[\s\S]*?\}/,
    'solid-preview-shape-bar should dispose and reset active controller before remount',
  );
});

test('shader dialog shell remount disposes previous controller and cleans event listeners', () => {
  const source = readSource('src/app/browser/components/solid-shader-dialog.tsx');

  assertPattern(
    source,
    /if\s*\(activeShaderDialogController\)\s*\{[\s\S]*?activeShaderDialogController\.dispose\(\);[\s\S]*?activeShaderDialogController\s*=\s*null;[\s\S]*?\}/,
    'solid-shader-dialog should dispose and reset active controller before remount',
  );

  assertPattern(
    source,
    /const\s+disposeShell\s*=\s*\(\)\s*=>\s*\{[\s\S]*?removeEventListener\('click',\s*onOpenClick\);[\s\S]*?removeEventListener\('cancel',\s*onCancel\);[\s\S]*?removeEventListener\('click',\s*onDialogClick\);[\s\S]*?\}/,
    'solid-shader-dialog should remove all shell event listeners in disposeShell',
  );

  assertPattern(
    source,
    /dispose:\s*\(\)\s*=>\s*\{[\s\S]*?disposeShell\(\);[\s\S]*?contentController\.dispose\(\);[\s\S]*?\}/,
    'solid-shader-dialog controller.dispose should call shell and content disposers',
  );
});
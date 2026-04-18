import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

test('index.html mounts Svelte custom elements directly', () => {
  const source = readSource('src/app/browser/index.html');
  assert.match(source, /<lut-step-list[^>]*id="step-column"/);
  assert.match(source, /<lut-shader-dialog-content[^>]*id="shader-dialog-content"/);
  assert.match(source, /<lut-lut-editor-dialog-content[^>]*id="lut-editor-dialog-content"/);
});

test('main entry registers custom elements from a dedicated module', () => {
  const source = readSource('src/app/browser/main.ts');
  assert.match(source, /import '\.\/components\/register-custom-elements\.ts';/);
});

test('custom element host bridge is removed from browser components', () => {
  const source = readSource('src/app/browser/components/shader-dialog.ts');
  assert.doesNotMatch(source, /mountSvelteHost|setHostProps|destroyHost/);
});

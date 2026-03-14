import esbuild from 'esbuild';
import { solidPlugin } from 'esbuild-plugin-solid';

const watchMode = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/bundle.js',
  sourcemap: true,
  target: ['es2020'],
  format: 'iife',
  platform: 'browser',
  plugins: [solidPlugin({ dev: watchMode })],
};

if (watchMode) {
  const context = await esbuild.context(buildOptions);
  await context.watch();
  console.log('[build] watching for changes...');
} else {
  await esbuild.build(buildOptions);
}

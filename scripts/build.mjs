import esbuild from 'esbuild';
import { solidPlugin } from 'esbuild-plugin-solid';
import path from 'path';
import fs from 'fs';

const watchMode = process.argv.includes('--watch');

// Custom plugin to resolve TypeScript imports without explicit extensions

const typeScriptExtensionPlugin = {
  name: 'ts-extension-resolver',
  setup(build) {
    build.onResolve({ filter: /.*/ }, async (args) => {
      // Only handle relative imports without extension
      if (!args.path.startsWith('.')) {
        return;
      }
      
      if (args.path.endsWith('.ts') || args.path.endsWith('.tsx') || args.path.endsWith('.js') || args.path.endsWith('.json')) {
        return;
      }
      
      const { path: importPath } = args;
      const basePath = path.dirname(args.importer);
      const fullPath = path.resolve(basePath, importPath);
      
      // Try to resolve with .ts/.tsx extensions  
      const candidates = [
        fullPath + '.ts',
        fullPath + '.tsx',
        fullPath + '/index.ts',
        fullPath + '/index.tsx',
        fullPath + '.js',
        fullPath + '.json',
      ];
      
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          return {
            path: candidate,
          };
        }
      }
      
      return;
    });
  },
};

const buildOptions = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/bundle.js',
  sourcemap: true,
  target: ['es2020'],
  format: 'iife',
  platform: 'browser',
  loader: {
    '.ts': 'ts',
    '.tsx': 'tsx',
  },
  plugins: [typeScriptExtensionPlugin, solidPlugin({ dev: watchMode })],
};

if (watchMode) {
  const context = await esbuild.context(buildOptions);
  await context.watch();
  console.log('[build] watching for changes...');
} else {
  await esbuild.build(buildOptions);
}

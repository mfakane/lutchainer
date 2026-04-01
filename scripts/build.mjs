import esbuild from 'esbuild';
import { solidPlugin } from 'esbuild-plugin-solid';
import fs from 'fs';
import path from 'path';

const watchMode = process.argv.includes('--watch');
const distDir = path.resolve('dist');
const copyTargets = [
  {
    source: path.resolve('examples'),
    destination: path.join(distDir, 'examples'),
  },
  {
    source: path.resolve('styles.css'),
    destination: path.join(distDir, 'styles.css'),
  },
  {
    source: path.resolve('index.html'),
    destination: path.join(distDir, 'index.html'),
  },
];

function copyBuildAssets() {
  fs.mkdirSync(distDir, { recursive: true });

  for (const target of copyTargets) {
    if (path.basename(target.source) === 'index.html') {
      const indexHtml = fs.readFileSync(target.source, 'utf8')
        .replace(/src="dist\/bundle\.js"/g, 'src="bundle.js"');
      fs.writeFileSync(target.destination, indexHtml);
      continue;
    }

    fs.cpSync(target.source, target.destination, { recursive: true, force: true });
  }
}

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

const copyBuildAssetsPlugin = {
  name: 'copy-build-assets',
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length > 0) {
        return;
      }

      copyBuildAssets();
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
  plugins: [typeScriptExtensionPlugin, copyBuildAssetsPlugin, solidPlugin({ dev: watchMode })],
};

if (watchMode) {
  const context = await esbuild.context(buildOptions);
  await context.watch();
  console.log('[build] watching for changes...');
} else {
  await esbuild.build(buildOptions);
}

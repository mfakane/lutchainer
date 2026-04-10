import esbuild from 'esbuild';
import { vanillaExtractPlugin } from '@vanilla-extract/esbuild-plugin';
import { solidPlugin } from 'esbuild-plugin-solid';
import childProcess from 'child_process';
import fs from 'fs';
import path from 'path';

const watchMode = process.argv.includes('--watch');
const distDir = path.resolve('dist');
const webDir = path.join(distDir, 'web');
const cliDir = path.join(distDir, 'cli');
const copyTargets = [
  {
    source: path.resolve('examples'),
    destination: path.join(webDir, 'examples'),
  },
  {
    source: path.resolve('styles.css'),
    destination: path.join(webDir, 'styles.css'),
  },
  {
    source: path.resolve('index.html'),
    destination: path.join(webDir, 'index.html'),
  },
];

const legacyDistTargets = [
  path.join(distDir, 'bundle.js'),
  path.join(distDir, 'bundle.js.map'),
  path.join(distDir, 'index.html'),
  path.join(distDir, 'styles.css'),
  path.join(distDir, 'examples'),
];

function resolveBuildCommitId() {
  try {
    return childProcess.execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function prepareOutputDirs() {
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(webDir, { recursive: true });
  fs.mkdirSync(cliDir, { recursive: true });

  for (const target of legacyDistTargets) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function copyBuildAssets() {
  prepareOutputDirs();

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

const buildCommitId = resolveBuildCommitId();

const buildOptions = {
  entryPoints: ['src/app/browser/main.ts'],
  bundle: true,
  outfile: path.join(webDir, 'bundle.js'),
  sourcemap: true,
  target: ['es2020'],
  format: 'iife',
  platform: 'browser',
  loader: {
    '.ts': 'ts',
    '.tsx': 'tsx',
  },
  define: {
    __BUILD_COMMIT_ID__: JSON.stringify(buildCommitId),
  },
  plugins: [typeScriptExtensionPlugin, vanillaExtractPlugin(), copyBuildAssetsPlugin, solidPlugin({ dev: watchMode })],
};

const cliBuildOptions = {
  entryPoints: ['src/app/cli/main.ts'],
  bundle: true,
  outfile: path.join(cliDir, 'main.mjs'),
  sourcemap: true,
  target: ['node20'],
  format: 'esm',
  platform: 'node',
  loader: {
    '.ts': 'ts',
    '.tsx': 'tsx',
  },
  define: {
    __BUILD_COMMIT_ID__: JSON.stringify(buildCommitId),
  },
  banner: {
    js: '#!/usr/bin/env node',
  },
  plugins: [typeScriptExtensionPlugin],
};

if (watchMode) {
  prepareOutputDirs();
  const context = await esbuild.context(buildOptions);
  const cliContext = await esbuild.context(cliBuildOptions);
  await context.watch();
  await cliContext.watch();
  console.log('[build] watching for changes...');
} else {
  prepareOutputDirs();
  await esbuild.build(buildOptions);
  await esbuild.build(cliBuildOptions);
}

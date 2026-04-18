import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import path from 'node:path';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');
const browserFiles = [
  'src/app/browser/**/*.ts',
  'src/app/browser/**/*.tsx',
  'src/app/browser/**/*.svelte',
  'src/platforms/browser/**/*.ts',
  'src/platforms/browser/**/*.tsx',
  'src/platforms/webgl/**/*.ts',
  'src/platforms/webgl/**/*.tsx',
];
const cliFiles = [
  'src/app/cli/**/*.ts',
  'src/app/cli/**/*.mts',
  'src/app/cli/**/*.cts',
  'src/platforms/node/**/*.ts',
  'src/platforms/node/**/*.mts',
  'src/platforms/node/**/*.cts',
];
const testFiles = [
  'tests/**/*.ts',
  'tests/**/*.mts',
  'tests/**/*.cts',
];
const sharedTypedFiles = [
  'src/features/**/*.ts',
  'src/features/**/*.mts',
  'src/features/**/*.cts',
  'src/shared/**/*.ts',
  'src/shared/**/*.mts',
  'src/shared/**/*.cts',
  'src/types/**/*.ts',
  'src/types/**/*.mts',
  'src/types/**/*.cts',
  'src/types/**/*.d.ts',
];

export default defineConfig(
  includeIgnoreFile(gitignorePath),
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  {
    rules: {
      // typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
      // see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    }
  },
  {
    files: [
      ...browserFiles,
      ...cliFiles,
      ...testFiles,
      ...sharedTypedFiles,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    files: browserFiles,
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: cliFiles,
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: testFiles,
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    files: ['src/app/browser/**/*.svelte', 'src/app/browser/**/*.svelte.ts', 'src/app/browser/**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser,
        svelteConfig
      }
    },
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
  {
    files: testFiles,
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.mts', 'src/**/*.cts'],
    rules: {
      'preserve-caught-error': 'off',
    },
  }
);

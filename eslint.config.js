import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Rules shared by the pure layers (engine/ and data/).
 * They must run in Node (tests, balance simulator) and never touch the UI.
 */
const pureLayerRules = {
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
          message: 'engine/ and data/ must not depend on React. Put UI code in src/ui.',
        },
        {
          group: ['zustand', 'zustand/*', 'pixi.js', '@pixi/*'],
          message: 'engine/ and data/ must not depend on state or rendering libraries.',
        },
        {
          group: ['@/ui/*', '@/store/*', '**/ui/*', '**/store/*'],
          message: 'engine/ and data/ must not import UI or store code.',
        },
      ],
    },
  ],
  'no-restricted-globals': [
    'error',
    { name: 'window', message: 'No DOM in engine/ or data/.' },
    { name: 'document', message: 'No DOM in engine/ or data/.' },
    { name: 'localStorage', message: 'Persistence belongs in src/store.' },
  ],
  'no-restricted-properties': [
    'error',
    {
      object: 'Math',
      property: 'random',
      message: 'Use the seeded RNG from src/engine/rng.ts so runs are reproducible.',
    },
    {
      object: 'Date',
      property: 'now',
      message: 'Game time is the in-game calendar (src/engine/calendar.ts).',
    },
  ],
};

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Architecture guard: the game rules stay pure TypeScript.
  {
    files: ['src/engine/**/*.ts', 'src/data/**/*.ts'],
    rules: pureLayerRules,
  },

  {
    files: ['vite.config.ts', 'eslint.config.js', 'scripts/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // Must stay last: turns off rules that fight with Prettier.
  prettier,
);

import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const vitestGlobals = {
  afterAll: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  beforeEach: 'readonly',
  describe: 'readonly',
  expect: 'readonly',
  it: 'readonly',
  test: 'readonly',
  vi: 'readonly',
};

export default [
  {
    ignores: [
      '.expo/**',
      'android/**',
      'assets/**',
      'coverage/**',
      'node_modules/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2024,
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.es2024,
        ...vitestGlobals,
        __DEV__: 'readonly',
        FormData: 'readonly',
        URL: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-debugger': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-fallthrough': 'error',
      'no-redeclare': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  {
    files: ['src/mobile/app/**/*.{ts,tsx}'],
    ignores: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      complexity: ['error', 35],
      'max-depth': ['error', 5],
      'max-lines-per-function': [
        'error',
        { max: 800, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    // React Native has no global default for `maxFontSizeMultiplier`, so a
    // screen that reaches for the raw `Text` opts itself out of the app's
    // dynamic-type cap without anyone noticing. `AppText` owns that decision;
    // tests stay free to assert against the host component.
    files: ['src/mobile/app/**/*.tsx'],
    ignores: [
      '**/__tests__/**',
      '**/*.test.tsx',
      'src/mobile/app/shared/components/ui/AppText.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Text'],
              message:
                'Import AppText from @/mobile/app/shared/components/ui/AppText so the text keeps the app-wide font-scale cap.',
            },
            {
              name: 'react-native',
              importNames: ['Modal'],
              message:
                'Open layers through AppModal (or ModalScaffold for a sheet or dialog) so the window settings stay in one place.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'src/mobile/app/app-shell/startup/*.ts',
      'src/mobile/app/data/hooks/useMapMarkersQuery.ts',
      'src/mobile/app/data/repositories/mapMarkersRepository.ts',
      'src/mobile/app/features/home/application/useHomeFeedScreenState.ts',
      'src/mobile/app/features/lists/application/useListDetailScreenState.ts',
      'src/mobile/app/features/profile/application/useUserProfileScreenState.ts',
      'src/mobile/app/platform/network/*.ts',
      'src/mobile/app/shared/performance/*.ts',
    ],
    ignores: ['**/__tests__/**'],
    rules: {
      complexity: ['error', 15],
      'max-depth': ['error', 4],
      'max-lines': [
        'error',
        { max: 380, skipBlankLines: true, skipComments: true },
      ],
      'max-lines-per-function': [
        'error',
        { max: 220, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    files: ['supabase/functions/**/*.{ts,tsx}'],
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      complexity: ['error', 80],
      'max-depth': ['error', 5],
      'max-lines-per-function': [
        'error',
        { max: 800, skipBlankLines: true, skipComments: true },
      ],
    },
  },
];

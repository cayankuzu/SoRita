import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(configDirectory, 'src'),
      'react-native': path.resolve(
        configDirectory,
        'src/mobile/app/test/mocks/react-native.ts',
      ),
    },
  },
  test: {
    environment: 'node',
    maxWorkers: 1,
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'supabase/functions/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
      include: [
        'src/mobile/app/data/**/*.ts',
        'src/mobile/app/data/**/*.tsx',
        'src/mobile/app/features/**/application/**/*.ts',
        'src/mobile/app/features/**/application/**/*.tsx',
        'src/mobile/app/app-shell/auth/session/**/*.ts',
        'supabase/functions/**/*.ts',
      ],
      exclude: [
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        'supabase/functions/**/index.ts',
      ],
    },
    server: {
      deps: {
        inline: [
          'react-native',
          '@react-native',
          '@react-navigation',
          'expo',
          'expo-file-system',
          'expo-linking',
          'expo-constants',
        ],
      },
    },
  },
});

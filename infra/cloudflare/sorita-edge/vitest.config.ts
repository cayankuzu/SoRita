import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

const TEST_SECRET = 'test-only-secret-value-with-at-least-32-characters';

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        bindings: {
          IP_HASH_PEPPER: `${TEST_SECRET}-ip`,
          ORIGIN_HMAC_SECRET: `${TEST_SECRET}-hmac`,
          SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key-not-a-production-secret',
        },
      },
      wrangler: {
        configPath: './wrangler.jsonc',
      },
    }),
  ],
  test: {
    include: ['test/**/*.test.ts'],
  },
});

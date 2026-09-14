import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/mobile/app/shared/components/brand/SoRitaLogo', () => ({
  SoRitaLogo: () => React.createElement('Logo', null, 'SoRita'),
}));

describe('AppConfigErrorScreen', () => {
  it('keeps internal configuration names out of the production-facing fallback', async () => {
    const { AppConfigErrorScreen } = await import(
      '@/mobile/app/app-shell/startup/AppConfigErrorScreen'
    );
    let renderer: TestRenderer.ReactTestRenderer | undefined;

    act(() => {
      renderer = TestRenderer.create(
        <AppConfigErrorScreen missingEnvVars={['EXPO_PUBLIC_INTERNAL_SERVICE']} />,
      );
    });

    const output = JSON.stringify(renderer?.toJSON());
    expect(output).toContain('Uygulama başlatılamadı');
    expect(output).not.toContain('EXPO_PUBLIC_INTERNAL_SERVICE');
  });
});

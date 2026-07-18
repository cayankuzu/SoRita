import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

const captureAppExceptionMock = vi.fn();

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/mobile/app/platform/observability/sentry', () => ({
  captureAppException: captureAppExceptionMock,
}));

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function ThrowingChild(): never {
  throw new Error('boom');
}

describe('AppErrorBoundary', () => {
  it('renders the crash fallback and reports the exception', async () => {
    const { AppErrorBoundary } = await import('@/mobile/app/app-shell/startup/AppErrorBoundary');
    let renderer: TestRenderer.ReactTestRenderer | undefined;

    act(() => {
      renderer = TestRenderer.create(
        <AppErrorBoundary>
          <ThrowingChild />
        </AppErrorBoundary>,
      );
    });

    expect(captureAppExceptionMock).toHaveBeenCalled();
    expect(JSON.stringify(renderer?.toJSON())).toContain('Bir şeyler ters gitti');
    expect(JSON.stringify(renderer?.toJSON())).toContain('Yeniden dene');
  });
});

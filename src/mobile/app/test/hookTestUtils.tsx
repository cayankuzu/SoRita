import React, { type PropsWithChildren } from 'react';
import TestRenderer, { act } from 'react-test-renderer';

type RenderHookResult<TResult> = {
  rerender: () => void;
  result: {
    current: TResult;
  };
  unmount: () => void;
};

export { act };

export function renderHook<TResult>(
  callback: () => TResult,
  options?: {
    wrapper?: React.ComponentType<PropsWithChildren>;
  },
): RenderHookResult<TResult> {
  const result: { current: TResult | undefined } = {
    current: undefined,
  };

  function TestComponent() {
    result.current = callback();
    return null;
  }

  const Wrapper = options?.wrapper;
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      Wrapper ? (
        <Wrapper>
          <TestComponent />
        </Wrapper>
      ) : (
        <TestComponent />
      ),
    );
  });

  return {
    rerender: () => {
      act(() => {
        renderer.update(
          Wrapper ? (
            <Wrapper>
              <TestComponent />
            </Wrapper>
          ) : (
            <TestComponent />
          ),
        );
      });
    },
    result: result as { current: TResult },
    unmount: () => {
      act(() => {
        renderer.unmount();
      });
    },
  };
}

export async function waitFor(assertion: () => void | Promise<void>, timeoutMs = 1000) {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await act(async () => {
        await Promise.resolve();
      });
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error('waitFor timed out');
}

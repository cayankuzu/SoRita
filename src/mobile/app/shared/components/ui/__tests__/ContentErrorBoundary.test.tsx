import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captureAppExceptionMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock('@/mobile/app/platform/observability/sentry', () => ({
  captureAppException: (...args: unknown[]) => captureAppExceptionMock(...args),
}));

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: {
    error: (...args: unknown[]) => loggerErrorMock(...args),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

const { AppText } = await import('@/mobile/app/shared/components/ui/AppText');
const { ContentErrorBoundary } = await import(
  '@/mobile/app/shared/components/ui/ContentErrorBoundary'
);
const { tr } = await import('@/mobile/app/shared/i18n/tr');

function Exploding(): React.ReactElement {
  throw new Error('field shape changed');
}

/** Every string the rendered tree puts on screen. */
function renderedText(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAllByType(AppText)
    .flatMap((node) => React.Children.toArray(node.props.children))
    .filter((child): child is string => typeof child === 'string');
}

function renderBoundary(children: React.ReactNode, source = 'test') {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <ContentErrorBoundary source={source}>{children}</ContentErrorBoundary>,
    );
  });
  return renderer;
}

describe('ContentErrorBoundary', () => {
  beforeEach(() => {
    captureAppExceptionMock.mockClear();
    loggerErrorMock.mockClear();
    // React prints the caught error itself; the boundary is what is under test.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders its content untouched while nothing throws', () => {
    const renderer = renderBoundary(<AppText>kart içeriği</AppText>);

    expect(renderedText(renderer)).toContain('kart içeriği');
    expect(renderedText(renderer)).not.toContain(tr.system.contentFailedDescription);
  });

  it('contains a crash instead of letting it reach the root boundary', () => {
    // Without this boundary the throw propagates to AppErrorBoundary and the
    // whole app goes to its crash screen. Here it must stay local.
    expect(() => renderBoundary(<Exploding />)).not.toThrow();
  });

  it('shows the failure notice in place of the content', () => {
    const renderer = renderBoundary(<Exploding />);

    expect(renderedText(renderer)).toContain(tr.system.contentFailedDescription);
    expect(renderedText(renderer)).toContain(tr.system.contentFailedRetry);
  });

  it('reports the failure with the surface named, so it is findable', () => {
    renderBoundary(<Exploding />, 'HomeFeedCardRow');

    expect(captureAppExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'field shape changed' }),
      expect.objectContaining({ source: 'HomeFeedCardRow' }),
    );
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'content-error-boundary',
      expect.any(String),
      expect.objectContaining({ source: 'HomeFeedCardRow' }),
    );
  });

  it('recovers a transient failure when retried', () => {
    let shouldThrow = true;

    function Flaky(): React.ReactElement {
      if (shouldThrow) {
        throw new Error('transient');
      }
      return <AppText>geri geldi</AppText>;
    }

    const renderer = renderBoundary(<Flaky />);
    expect(renderedText(renderer)).toContain(tr.system.contentFailedDescription);

    shouldThrow = false;
    const retry = renderer.root.findByProps({
      accessibilityLabel: tr.system.contentFailedRetry,
    });
    act(() => {
      retry.props.onPress();
    });

    expect(renderedText(renderer)).toContain('geri geldi');
    expect(renderedText(renderer)).not.toContain(tr.system.contentFailedDescription);
  });
});

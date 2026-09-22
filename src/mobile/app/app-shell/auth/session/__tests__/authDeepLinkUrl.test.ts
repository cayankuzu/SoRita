import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { addEventListenerMock, getInitialURLMock } = vi.hoisted(() => ({
  addEventListenerMock: vi.fn(),
  getInitialURLMock: vi.fn(),
}));

vi.mock('expo-linking', () => ({
  addEventListener: addEventListenerMock,
  getInitialURL: getInitialURLMock,
}));

const RESET_LINK =
  'sorita://reset-password?flow=password-reset&state=s1#access_token=at&refresh_token=rt';

async function loadModule() {
  vi.resetModules();
  return import('@/mobile/app/app-shell/auth/session/authDeepLinkUrl');
}

function emitUrl(url: string) {
  const handler = addEventListenerMock.mock.calls.at(-1)?.[1] as (event: { url: string }) => void;
  handler({ url });
}

describe('auth deep link capture', () => {
  beforeEach(() => {
    addEventListenerMock.mockReset();
    getInitialURLMock.mockReset();
    addEventListenerMock.mockReturnValue({ remove: () => undefined });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('is unresolved until the launch URL has been looked up', async () => {
    const module = await loadModule();
    getInitialURLMock.mockReturnValue(new Promise(() => undefined));

    module.startAuthDeepLinkCapture();

    expect(module.getAuthDeepLinkSnapshot()).toEqual({ resolved: false, url: null });
  });

  it('captures the launch URL of a cold start', async () => {
    const module = await loadModule();
    getInitialURLMock.mockResolvedValue(RESET_LINK);

    module.startAuthDeepLinkCapture();
    await vi.waitUntil(() => module.getAuthDeepLinkSnapshot().resolved);

    expect(module.getAuthDeepLinkSnapshot()).toEqual({ resolved: true, url: RESET_LINK });
  });

  it('resolves with no link when the app was not launched by one', async () => {
    const module = await loadModule();
    getInitialURLMock.mockResolvedValue(null);

    module.startAuthDeepLinkCapture();
    await vi.waitUntil(() => module.getAuthDeepLinkSnapshot().resolved);

    expect(module.getAuthDeepLinkSnapshot()).toEqual({ resolved: true, url: null });
  });

  // The defect measured on device: a warm launch delivers the link as an event
  // and navigates afterwards, so a listener registered by the screen is always
  // too late, and getInitialURL still reports the original launch intent. The
  // screen then fell back to route params, which carry a deep link's query but
  // never its fragment - where Supabase returns the recovery session.
  it('captures a warm-start link that arrives before any screen mounts', async () => {
    const module = await loadModule();
    getInitialURLMock.mockResolvedValue(null);

    module.startAuthDeepLinkCapture();
    emitUrl(RESET_LINK);

    expect(module.getAuthDeepLinkSnapshot()).toEqual({ resolved: true, url: RESET_LINK });
  });

  it('keeps the event link when the launch lookup resolves late with nothing', async () => {
    const module = await loadModule();
    let resolveInitial: (value: string | null) => void = () => undefined;
    getInitialURLMock.mockReturnValue(new Promise<string | null>((resolve) => {
      resolveInitial = resolve;
    }));

    module.startAuthDeepLinkCapture();
    emitUrl(RESET_LINK);
    resolveInitial(null);
    await vi.waitUntil(() => module.getAuthDeepLinkSnapshot().resolved);

    expect(module.getAuthDeepLinkSnapshot().url).toBe(RESET_LINK);
  });

  it('lets a newer link replace an older one', async () => {
    const module = await loadModule();
    getInitialURLMock.mockResolvedValue(null);

    module.startAuthDeepLinkCapture();
    emitUrl(RESET_LINK);
    emitUrl('sorita://reset-password?flow=password-reset&state=s2');

    expect(module.getAuthDeepLinkSnapshot().url).toBe(
      'sorita://reset-password?flow=password-reset&state=s2',
    );
  });

  it('subscribes to the url event exactly once however often it is started', async () => {
    const module = await loadModule();
    getInitialURLMock.mockResolvedValue(null);

    module.startAuthDeepLinkCapture();
    module.startAuthDeepLinkCapture();
    module.startAuthDeepLinkCapture();

    expect(addEventListenerMock).toHaveBeenCalledTimes(1);
  });

  it('survives a launch URL lookup that rejects', async () => {
    const module = await loadModule();
    getInitialURLMock.mockRejectedValue(new Error('no activity'));

    module.startAuthDeepLinkCapture();
    await vi.waitUntil(() => module.getAuthDeepLinkSnapshot().resolved);

    expect(module.getAuthDeepLinkSnapshot()).toEqual({ resolved: true, url: null });
  });

  // Capturing the link is only half of it: a screen that mounted while the
  // store was still empty has to be told when the link lands, or it waits for
  // ever on the spinner.
  it('re-renders a mounted reader when the link lands', async () => {
    const module = await loadModule();
    const { act, renderHook } = await import('@/mobile/app/test/hookTestUtils');
    getInitialURLMock.mockResolvedValue(null);
    module.startAuthDeepLinkCapture();

    const { result } = renderHook(() => module.useAuthDeepLink());
    expect(result.current.url).toBeNull();

    act(() => {
      emitUrl(RESET_LINK);
    });

    expect(result.current).toEqual({ resolved: true, url: RESET_LINK });
  });
});

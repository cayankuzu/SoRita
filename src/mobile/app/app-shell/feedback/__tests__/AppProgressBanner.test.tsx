import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('@/mobile/app/features/map/public/feedback', () => ({
  PlaceEditorSaveProgressBanner: () => null,
}));

vi.mock('@/mobile/app/shared/components/feedback/ActionMenuSheet', () => ({
  ActionMenuSheet: () => null,
}));

vi.mock('@/mobile/app/shared/components/feedback/ConfirmActionModal', () => ({
  ConfirmActionModal: () => null,
}));

import {
  AppProgressBannerHost,
  AppProgressBannerProvider,
} from '@/mobile/app/app-shell/feedback/AppProgressBanner';

describe('AppProgressBanner', () => {
  it('renders without crashing before the first navigation state exists', () => {
    expect(() => {
      act(() => {
        TestRenderer.create(
          <AppProgressBannerProvider>
            <AppProgressBannerHost />
          </AppProgressBannerProvider>,
        );
      });
    }).not.toThrow();
  });
});

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/mobile/app/app-shell/navigation/navigation', () => ({
  useAppNavigation: () => ({ goBack: vi.fn() }),
}));

vi.mock('@/mobile/app/features/settings/ui/components/SettingsHeader', () => ({
  SettingsHeader: (props: Record<string, unknown>) => React.createElement('SettingsHeader', props),
}));

vi.mock('@/mobile/app/platform/feedback/toast', () => ({ showToast: vi.fn() }));

vi.mock('@/mobile/app/shared/components/feedback/ConfirmActionModal', () => ({
  ConfirmActionModal: (props: Record<string, unknown>) => React.createElement('ConfirmActionModal', props),
}));

vi.mock('@/mobile/app/shared/components/ui/EmptyState', () => ({
  EmptyState: (props: Record<string, unknown>) => React.createElement('EmptyState', props),
}));

vi.mock('@/mobile/app/shared/components/ui/InlineNotice', () => ({
  InlineNotice: (props: Record<string, unknown>) => React.createElement('InlineNotice', props),
}));

vi.mock('@/mobile/app/shared/components/ui/SkeletonPlaceholder', () => ({
  PlaceCardSkeleton: () => React.createElement('PlaceCardSkeleton'),
}));

vi.mock('@/mobile/app/shared/components/ui/PrimaryButton', () => ({
  PrimaryButton: (props: Record<string, unknown>) => React.createElement('PrimaryButton', props),
}));

vi.mock('@/mobile/app/shared/components/ui/TextField', () => ({
  TextField: (props: Record<string, unknown>) => React.createElement('TextField', props),
}));

vi.mock('lucide-react-native', () => ({
  CircleSlash2: (props: Record<string, unknown>) => React.createElement('CircleSlash2', props),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: (props: Record<string, unknown>) => React.createElement('SafeAreaView', props),
}));

describe('UiCatalogScreen', () => {
  it('keeps the shared component state matrix visible for visual checks', async () => {
    const { UiCatalogScreen } = await import('../UiCatalogScreen');
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<UiCatalogScreen />);
    });

    const buttons = renderer.root.findAllByType('PrimaryButton' as unknown as React.ElementType);
    const fields = renderer.root.findAllByType('TextField' as unknown as React.ElementType);
    const notices = renderer.root.findAllByType('InlineNotice' as unknown as React.ElementType);

    expect(buttons.some((button) => button.props.loading)).toBe(true);
    expect(buttons.some((button) => button.props.disabled)).toBe(true);
    expect(buttons.map((button) => button.props.variant)).toEqual(
      expect.arrayContaining(['danger', 'secondary', 'success']),
    );
    expect(fields).toHaveLength(3);
    expect(fields.some((field) => field.props.status === 'success')).toBe(true);
    expect(notices.map((notice) => notice.props.tone)).toEqual(
      expect.arrayContaining(['danger', 'warning']),
    );
    expect(renderer.root.findAllByType('PlaceCardSkeleton' as unknown as React.ElementType)).toHaveLength(1);
    expect(renderer.root.findAllByType('EmptyState' as unknown as React.ElementType)).toHaveLength(1);
  });
});

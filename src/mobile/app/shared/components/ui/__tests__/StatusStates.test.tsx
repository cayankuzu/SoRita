import React from 'react';
import { View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';

describe('status-state accessibility', () => {
  it('does not reserve a text row for an empty description', () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <EmptyState description="" icon={<View />} title="Henüz bağlantı yok" />,
      );
    });

    expect(renderer.root.findAllByType(AppText)).toHaveLength(1);
  });

  it('keeps an empty-state action independently focusable', () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <EmptyState
          actionLabel="Yeniden dene"
          description="İçerik şu anda gösterilemiyor."
          icon={<AppText>!</AppText>}
          onAction={vi.fn()}
          title="İçerik yüklenemedi"
        />,
      );
    });

    expect(
      renderer.root.findAll((node) => node.props.accessibilityRole === 'summary'),
    ).toHaveLength(0);
    expect(
      renderer.root.findAll(
        (node) =>
          String(node.type) === 'Pressable' &&
          node.props.accessibilityRole === 'button' &&
          node.props.accessibilityLabel === 'Yeniden dene',
      ),
    ).toHaveLength(1);
    expect(
      renderer.root.findAll(
        (node) => String(node.type) === 'Text' && node.props.accessibilityRole === 'header',
      ),
    ).toHaveLength(1);
  });

  it('renders a secondary empty-state action without requiring a primary action', () => {
    const onSecondaryAction = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <EmptyState
          icon={<View />}
          onSecondaryAction={onSecondaryAction}
          secondaryActionLabel="Filtreleri temizle"
          title="Sonuç bulunamadı"
        />,
      );
    });

    const action = renderer.root.find(
      (node) =>
        String(node.type) === 'Pressable' &&
        node.props.accessibilityLabel === 'Filtreleri temizle',
    );

    act(() => {
      action.props.onPress({ persist: vi.fn() });
    });

    expect(onSecondaryAction).toHaveBeenCalledTimes(1);
  });

  it('announces a danger notice without grouping its action', () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <InlineNotice
          actionLabel="Tekrar dene"
          onAction={vi.fn()}
          title="Bağlantı kurulamadı"
          tone="danger"
        />,
      );
    });

    expect(
      renderer.root.findAll(
        (node) =>
          String(node.type) === 'View' &&
          node.props.accessibilityLiveRegion === 'assertive' &&
          node.props.accessibilityRole !== 'alert',
      ),
    ).toHaveLength(1);
    expect(
      renderer.root.findAll(
        (node) => String(node.type) === 'Text' && node.props.accessibilityRole === 'alert',
      ),
    ).toHaveLength(1);
    expect(
      renderer.root.findAll(
        (node) =>
          String(node.type) === 'Pressable' &&
          node.props.accessibilityRole === 'button',
      ),
    ).toHaveLength(1);
  });
});

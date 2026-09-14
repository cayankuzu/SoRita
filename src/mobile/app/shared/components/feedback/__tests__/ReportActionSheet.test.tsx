import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  Flag: (props: Record<string, unknown>) => React.createElement('Flag', props),
  X: (props: Record<string, unknown>) => React.createElement('X', props),
}));

vi.mock('@/mobile/app/shared/components/feedback/ModalScaffold', () => ({
  ModalScaffold: ({ children, footer, ...props }: Record<string, unknown>) =>
    React.createElement('ModalScaffold', props, children as React.ReactNode, footer as React.ReactNode),
}));

vi.mock('@/mobile/app/shared/components/ui/IconButton', () => ({
  IconButton: (props: Record<string, unknown>) => React.createElement('IconButton', props),
}));

vi.mock('@/mobile/app/shared/components/ui/InstantPressable', () => ({
  InstantPressable: (props: Record<string, unknown>) =>
    React.createElement('InstantPressable', props, props.children as React.ReactNode),
}));

vi.mock('@/mobile/app/shared/components/ui/PrimaryButton', () => ({
  PrimaryButton: (props: Record<string, unknown>) => React.createElement('PrimaryButton', props),
}));

import { ReportActionSheet } from '@/mobile/app/shared/components/feedback/ReportActionSheet';
import { tr } from '@/mobile/app/shared/i18n/tr';

function renderSheet(overrides: Partial<React.ComponentProps<typeof ReportActionSheet>> = {}) {
  const props: React.ComponentProps<typeof ReportActionSheet> = {
    visible: true,
    targetType: 'comment',
    title: 'Yorumu bildir',
    reportReason: 'Spam',
    onReportReasonChange: vi.fn(),
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  let renderer!: TestRenderer.ReactTestRenderer;

  act(() => {
    renderer = TestRenderer.create(<ReportActionSheet {...props} />);
  });

  return { props, renderer };
}

describe('ReportActionSheet', () => {
  it('shows target-appropriate reasons as semantic radio controls', () => {
    const { renderer } = renderSheet();
    const radios = renderer.root.findAll(
      (node) => String(node.type) === 'InstantPressable' && node.props.accessibilityRole === 'radio',
    );

    expect(radios.map((radio) => radio.props.accessibilityLabel)).toEqual([
      'Uygunsuz içerik',
      'Spam',
      'Diğer',
    ]);
    expect(radios.find((radio) => radio.props.accessibilityLabel === 'Spam')?.props.accessibilityState)
      .toMatchObject({ checked: true, disabled: false });
  });

  it('locks every dismissal and form control while a report is being sent', async () => {
    let resolveSubmission!: () => void;
    const submission = new Promise<void>((resolve) => {
      resolveSubmission = resolve;
    });
    const { props, renderer } = renderSheet({ onSubmit: () => submission });
    const sendButton = renderer.root.find(
      (node) => String(node.type) === 'PrimaryButton' && node.props.title === tr.common.send,
    );
    let pending!: Promise<void>;

    await act(async () => {
      pending = sendButton.props.onPress();
      await Promise.resolve();
    });

    const scaffold = renderer.root.find((node) => String(node.type) === 'ModalScaffold');
    const cancelButton = renderer.root.find(
      (node) => String(node.type) === 'PrimaryButton' && node.props.title === tr.common.cancel,
    );
    const closeButton = renderer.root.find((node) => String(node.type) === 'IconButton');
    const input = renderer.root.find((node) => String(node.type) === 'TextInput');
    const radios = renderer.root.findAll(
      (node) => String(node.type) === 'InstantPressable' && node.props.accessibilityRole === 'radio',
    );

    expect(sendButton.props.loading).toBe(true);
    expect(cancelButton.props.disabled).toBe(true);
    expect(closeButton.props.disabled).toBe(true);
    expect(input.props.editable).toBe(false);
    expect(radios.every((radio) => radio.props.disabled === true)).toBe(true);

    act(() => scaffold.props.onClose());
    expect(props.onClose).not.toHaveBeenCalled();

    resolveSubmission();
    await act(async () => pending);
  });

  it('keeps the sheet open and renders an assertive inline error after failure', async () => {
    const onClose = vi.fn();
    const { renderer } = renderSheet({
      onClose,
      onSubmit: vi.fn().mockRejectedValue(new Error('Bildirim gönderilemedi')),
    });
    const sendButton = renderer.root.find(
      (node) => String(node.type) === 'PrimaryButton' && node.props.title === tr.common.send,
    );

    await act(async () => {
      await sendButton.props.onPress();
    });

    const alert = renderer.root.find(
      (node) => String(node.type) === 'Text' && node.props.accessibilityRole === 'alert',
    );
    expect(alert.props.accessibilityLiveRegion).toBe('assertive');
    expect(alert.props.children).toBe('Bildirim gönderilemedi');
    expect(onClose).not.toHaveBeenCalled();
  });
});

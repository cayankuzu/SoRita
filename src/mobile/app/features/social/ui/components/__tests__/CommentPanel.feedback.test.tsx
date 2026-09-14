import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn() }));

vi.mock('lucide-react-native', () => ({
  X: (props: Record<string, unknown>) => React.createElement('X', props),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

vi.mock('@/mobile/app/features/social/ui/components/comment-panel/CommentComposer', () => ({
  CommentComposer: (props: Record<string, unknown>) =>
    React.createElement('CommentComposer', props),
}));

vi.mock('@/mobile/app/features/social/ui/components/comment-panel/CommentActionSheet', () => ({
  CommentActionSheet: (props: Record<string, unknown>) =>
    React.createElement('CommentActionSheet', props),
}));

vi.mock('@/mobile/app/features/social/ui/components/comment-panel/CommentThread', () => ({
  CommentThread: (props: Record<string, unknown>) =>
    React.createElement('CommentThread', props),
}));

vi.mock('@/mobile/app/features/social/ui/components/LikersPanel', () => ({
  LikersPanel: (props: Record<string, unknown>) => React.createElement('LikersPanel', props),
}));

vi.mock('@/mobile/app/shared/components/feedback/ReportActionSheet', () => ({
  ReportActionSheet: (props: Record<string, unknown>) =>
    React.createElement('ReportActionSheet', props),
}));

vi.mock('@/mobile/app/shared/components/ui/IconButton', () => ({
  IconButton: (props: Record<string, unknown>) => React.createElement('IconButton', props),
}));

vi.mock('@/mobile/app/shared/components/ui/InlineNotice', () => ({
  InlineNotice: (props: Record<string, unknown>) => React.createElement('InlineNotice', props),
}));

vi.mock('@/mobile/app/shared/hooks/useModalAnimationType', () => ({
  useModalAnimationType: () => 'none',
}));

import { CommentPanel } from '@/mobile/app/features/social/ui/components/CommentPanel';

const baseProps: React.ComponentProps<typeof CommentPanel> = {
  visible: true,
  comments: [],
  commentText: '',
  reportReason: '',
  onClose: vi.fn(),
  onCommentTextChange: vi.fn(),
  onSubmit: vi.fn(),
  onStartEdit: vi.fn(),
  onStartReply: vi.fn(),
  onCancelEdit: vi.fn(),
  onCancelReply: vi.fn(),
  onDeleteComment: vi.fn(),
  onToggleCommentLike: vi.fn(),
  onStartReport: vi.fn(),
  onCloseReport: vi.fn(),
  onReportDetailsChange: vi.fn(),
  onReportReasonChange: vi.fn(),
  onReportSubmit: vi.fn(),
};

describe('CommentPanel feedback', () => {
  it('announces the first comment page while it is loading', () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<CommentPanel {...baseProps} initialLoading />);
    });

    const list = renderer.root.find((node) => String(node.type) === 'FlatList');
    expect(list.props.accessibilityState).toMatchObject({ busy: true });
    let emptyState!: TestRenderer.ReactTestRenderer;
    act(() => {
      emptyState = TestRenderer.create(list.props.ListEmptyComponent);
    });
    const progress = emptyState.root.find(
      (node) => node.props.accessibilityRole === 'progressbar',
    );
    expect(progress.props.accessibilityLiveRegion).toBe('polite');
  });

  it('shows a retryable error instead of an empty-content message', () => {
    const onRefreshComments = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <CommentPanel
          {...baseProps}
          errorMessage="Yorumlar yüklenemedi"
          onRefreshComments={onRefreshComments}
        />,
      );
    });

    const list = renderer.root.find((node) => String(node.type) === 'FlatList');
    let emptyState!: TestRenderer.ReactTestRenderer;
    act(() => {
      emptyState = TestRenderer.create(list.props.ListEmptyComponent);
    });
    const notice = emptyState.root.find(
      (node) => String(node.type) === 'InlineNotice',
    );
    expect(notice.props.description).toBe('Yorumlar yüklenemedi');
    expect(notice.props.onAction).toBe(onRefreshComments);
  });
});

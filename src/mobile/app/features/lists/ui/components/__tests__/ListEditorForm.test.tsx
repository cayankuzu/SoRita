import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  Globe: (props: Record<string, unknown>) => React.createElement('Globe', props),
  ImagePlus: (props: Record<string, unknown>) => React.createElement('ImagePlus', props),
  Lock: (props: Record<string, unknown>) => React.createElement('Lock', props),
  X: (props: Record<string, unknown>) => React.createElement('X', props),
}));

vi.mock('@/mobile/app/shared/components/media/MediaSelectionPreview', () => ({
  MediaSelectionPreview: (props: Record<string, unknown>) =>
    React.createElement('MediaSelectionPreview', props),
}));

vi.mock('@/mobile/app/shared/components/ui/TextField', () => ({
  TextField: (props: Record<string, unknown>) => React.createElement('TextField', props),
}));

import { ListEditorForm } from '@/mobile/app/features/lists/ui/components/ListEditorForm';
import { t } from '@/mobile/app/shared/i18n';

describe('ListEditorForm', () => {
  it('orders required basics before privacy and optional cover content', () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ListEditorForm
          description=""
          isPublic={false}
          loading={false}
          name="Akşam rotası"
          onCoverPress={vi.fn()}
          onDescriptionChange={vi.fn()}
          onNameChange={vi.fn()}
          onPreviewCover={vi.fn()}
          onRemoveCover={vi.fn()}
          onVisibilityChange={vi.fn()}
        />,
      );
    });

    const headings = renderer.root.findAll(
      (node) => typeof node.type === 'string' && node.props.accessibilityRole === 'header',
    );
    expect(headings.map((heading) => heading.children.join(''))).toEqual([
      t.listEditor.basicsTitle,
      t.listEditor.privacyTitle,
      t.listEditor.coverTitle,
    ]);

    const fields = renderer.root.findAll((node) => String(node.type) === 'TextField');
    expect(fields.map((field) => field.props.label)).toEqual([
      t.listEditor.titleLabel,
      `${t.listEditor.descriptionLabel} (${t.common.optional})`,
    ]);

    const radios = renderer.root.findAll(
      (node) => typeof node.type === 'string' && node.props.accessibilityRole === 'radio',
    );
    expect(radios.map((radio) => radio.props.accessibilityState.checked)).toEqual([
      false,
      true,
    ]);
  });
});

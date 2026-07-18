import React from 'react';
import {
  Text,
  type TextProps,
  type TextStyle,
} from 'react-native';

import { semanticColors, typography } from '@/mobile/app/shared/theme/tokens';

type AppTextTone = 'danger' | 'default' | 'inverse' | 'muted' | 'secondary' | 'success' | 'warning';
type AppTextVariant =
  | 'body'
  | 'caption'
  | 'display'
  | 'label'
  | 'metadata'
  | 'section'
  | 'title';

type AppTextProps = TextProps & {
  tone?: AppTextTone;
  variant?: AppTextVariant;
};

const variantStyles: Record<AppTextVariant, TextStyle> = {
  body: typography.bodyText,
  caption: typography.captionText,
  display: typography.display,
  label: typography.labelText,
  metadata: typography.metadataText,
  section: typography.section,
  title: typography.title,
};

const toneColors: Record<AppTextTone, string> = {
  danger: semanticColors.state.dangerText,
  default: semanticColors.content.primary,
  inverse: semanticColors.content.inverse,
  muted: semanticColors.content.muted,
  secondary: semanticColors.content.secondary,
  success: semanticColors.state.successText,
  warning: semanticColors.state.warningText,
};

export function AppText({
  allowFontScaling = true,
  style,
  tone = 'default',
  variant = 'body',
  ...props
}: AppTextProps) {
  return (
    <Text
      {...props}
      allowFontScaling={allowFontScaling}
      style={[
        variantStyles[variant],
        { color: toneColors[tone] },
        style,
      ]}
    />
  );
}

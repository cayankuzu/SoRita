import React from 'react';
import { Text, type TextProps } from 'react-native';

import { textScale } from '@/mobile/app/shared/theme/tokens';

export type AppTextProps = TextProps & {
  /**
   * Dense rows - tab labels, badges, counters - cap tighter than reading copy.
   */
  scaleLimit?: keyof typeof textScale;
};

/**
 * What `<AppText ref>` hands back. Modals and lightboxes hold one to move
 * screen-reader focus onto their title when they open.
 */
export type AppTextRef = React.ComponentRef<typeof Text>;

/**
 * The one text primitive every screen renders through, so the dynamic-type cap
 * is a single decision instead of something 478 call sites each have to
 * remember. `eslint no-restricted-imports` keeps `Text` from being imported
 * straight from react-native anywhere else.
 *
 * Props spread last on purpose: a caller that genuinely needs its own
 * `maxFontSizeMultiplier` still wins over the default.
 */
export const AppText = React.forwardRef<AppTextRef, AppTextProps>(function AppText(
  { scaleLimit = 'content', ...props },
  ref,
) {
  return <Text ref={ref} maxFontSizeMultiplier={textScale[scaleLimit]} {...props} />;
});

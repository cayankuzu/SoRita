import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  LayoutAnimation,
  NativeSyntheticEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  TextLayoutEventData,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { RichText } from '@/mobile/app/shared/components/ui/RichText';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize, minTouchSize, spacing, zIndex } from '@/mobile/app/shared/theme/tokens';
import { useReduceMotion } from '@/mobile/app/shared/hooks/useReduceMotion';
import type { RichTextVariant } from '@/mobile/app/shared/utils/richText';

type ExpandableTextProps = {
  text: string;
  collapsedLines?: number;
  textStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  iconColor?: string;
  preserveLineBreaks?: boolean;
  maxCollapsedLinesWhenPreservingBreaks?: number;
  onMentionPress?: (mention: string) => void;
  showIndicator?: boolean;
  renderContent?: () => React.ReactNode;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  variant?: RichTextVariant;
};

const EXPAND_ICON_HIT_SLOP =
  (minTouchSize) / 2 - 7;

export function ExpandableText({
  text,
  collapsedLines = 2,
  textStyle,
  containerStyle,
  iconColor = colors.textSoft,
  preserveLineBreaks = false,
  maxCollapsedLinesWhenPreservingBreaks,
  onMentionPress,
  showIndicator = true,
  renderContent,
  expanded,
  onExpandedChange,
  variant = 'default',
}: ExpandableTextProps) {
  const reduceMotion = useReduceMotion();
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [hasExpandedLinks, setHasExpandedLinks] = useState(false);
  const [isExpandable, setIsExpandable] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const normalizedText = useMemo(() => text.replace(/\r\n?/g, '\n'), [text]);
  const shouldRenderPlainText = preserveLineBreaks && !renderContent;
  const usesRichText = !renderContent && !shouldRenderPlainText;
  const isControlled = typeof expanded === 'boolean';
  const resolvedExpanded = isControlled ? Boolean(expanded) : internalExpanded;
  const contentExpanded = resolvedExpanded || hasExpandedLinks;
  const resolvedCollapsedLines = useMemo(() => {
    if (!preserveLineBreaks) {
      return collapsedLines;
    }

    const explicitLineCount = normalizedText.split('\n').length;
    const maxPreservedLineCount =
      maxCollapsedLinesWhenPreservingBreaks ?? explicitLineCount;

    return Math.max(
      collapsedLines,
      Math.min(explicitLineCount, maxPreservedLineCount),
    );
  }, [
    collapsedLines,
    maxCollapsedLinesWhenPreservingBreaks,
    normalizedText,
    preserveLineBreaks,
  ]);

  const content = useMemo(() => {
    if (!renderContent) {
      return null;
    }

    return renderContent();
  }, [renderContent]);

  useEffect(() => {
    if (!isControlled) {
      setInternalExpanded(false);
    }
    setHasExpandedLinks(false);
  }, [containerWidth, isControlled, normalizedText, resolvedCollapsedLines]);

  const handleToggleExpanded = useCallback(() => {
    if (!isExpandable) {
      return;
    }

    const nextExpanded = !resolvedExpanded;

    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }

    if (!isControlled) {
      setInternalExpanded(nextExpanded);
    }

    onExpandedChange?.(nextExpanded);
  }, [isControlled, isExpandable, onExpandedChange, reduceMotion, resolvedExpanded]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setContainerWidth((current) => (current === nextWidth ? current : nextWidth));
  }, []);

  const handleMeasureLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      const nextIsExpandable =
        event.nativeEvent.lines.length > resolvedCollapsedLines;
      setIsExpandable((current) => (current === nextIsExpandable ? current : nextIsExpandable));
    },
    [resolvedCollapsedLines],
  );

  return (
    <View onLayout={handleLayout} style={[styles.wrapper, containerStyle]}>
      {containerWidth > 0 ? (
        renderContent ? (
          <AppText
            onTextLayout={handleMeasureLayout}
            style={[styles.text, textStyle, styles.hiddenMeasure]}
            pointerEvents="none"
          >
            {content}
          </AppText>
        ) : shouldRenderPlainText ? (
          <AppText
            onTextLayout={handleMeasureLayout}
            style={[styles.text, textStyle, styles.hiddenMeasure]}
            pointerEvents="none"
          >
            {normalizedText}
          </AppText>
        ) : (
          <RichText
            text={normalizedText}
            variant={variant}
            onMentionPress={onMentionPress}
            onTextLayout={handleMeasureLayout}
            style={[styles.text, textStyle, styles.hiddenMeasure]}
            pointerEvents="none"
          />
        )
      ) : null}

      <Pressable
        accessibilityRole={isExpandable && !usesRichText ? 'button' : undefined}
        accessibilityState={
          isExpandable && !usesRichText ? { expanded: resolvedExpanded } : undefined
        }
        onPress={(event) => {
          event.stopPropagation?.();
          handleToggleExpanded();
        }}
        disabled={!isExpandable || usesRichText}
        style={styles.pressable}
      >
        <View style={styles.contentWrap}>
          {renderContent ? (
            <AppText
              numberOfLines={contentExpanded ? undefined : resolvedCollapsedLines}
              ellipsizeMode="tail"
              style={[
                styles.text,
                textStyle,
                isExpandable && showIndicator ? styles.textWithIndicator : null,
              ]}
            >
              {content}
            </AppText>
          ) : shouldRenderPlainText ? (
            <AppText
              numberOfLines={contentExpanded ? undefined : resolvedCollapsedLines}
              ellipsizeMode="tail"
              style={[
                styles.text,
                textStyle,
                isExpandable && showIndicator ? styles.textWithIndicator : null,
              ]}
            >
              {normalizedText}
            </AppText>
          ) : (
            <RichText
              text={normalizedText}
              variant={variant}
              numberOfLines={contentExpanded ? undefined : resolvedCollapsedLines}
              onExpandedLinksChange={setHasExpandedLinks}
              onMentionPress={onMentionPress}
              ellipsizeMode="tail"
              style={[
                styles.text,
                textStyle,
                isExpandable && showIndicator ? styles.textWithIndicator : null,
              ]}
            />
          )}

          {isExpandable && showIndicator ? (
            usesRichText ? (
              <Pressable
                accessibilityLabel={
                  contentExpanded ? tr.common.collapseLink : tr.common.expandLink
                }
                accessibilityRole="button"
                accessibilityState={{ expanded: contentExpanded }}
                hitSlop={EXPAND_ICON_HIT_SLOP}
                onPress={(event) => {
                  event.stopPropagation?.();
                  handleToggleExpanded();
                }}
                style={[styles.iconWrap, contentExpanded ? styles.iconWrapExpanded : null]}
              >
                <ChevronRight color={iconColor} size={iconSize.sm} />
              </Pressable>
            ) : (
              <View
                accessible={false}
                style={[styles.iconWrap, contentExpanded ? styles.iconWrapExpanded : null]}
              >
                <ChevronRight color={iconColor} size={iconSize.sm} />
              </View>
            )
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  pressable: {
    width: '100%',
  },
  contentWrap: {
    position: 'relative',
    width: '100%',
  },
  text: {
    color: colors.text,
  },
  textWithIndicator: {
    paddingRight: spacing.lg,
  },
  hiddenMeasure: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -7800,
    height: 0,
    opacity: 0,
    overflow: 'hidden',
    zIndex: zIndex.behind,
  },
  iconWrap: {
    position: 'absolute',
    right: 0,
    top: spacing.xxs,
  },
  iconWrapExpanded: {
    transform: [{ rotate: '90deg' }],
  },
});

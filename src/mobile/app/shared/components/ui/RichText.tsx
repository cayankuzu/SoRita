import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
} from 'react-native';

import { openSafeExternalUrl } from '@/mobile/app/shared/utils/safeLinks';
import {
  formatCollapsedRichLinkText,
  parseRichTextSegments,
  type RichTextVariant,
} from '@/mobile/app/shared/utils/richText';
import { colors } from '@/mobile/app/shared/theme/tokens';

type RichTextProps = Omit<TextProps, 'children' | 'style'> & {
  onExpandedLinksChange?: (hasExpandedLinks: boolean) => void;
  onMentionPress?: (mention: string) => void;
  text: string;
  variant?: RichTextVariant;
  style?: StyleProp<TextStyle>;
};

export function RichText({
  onExpandedLinksChange,
  onMentionPress,
  text,
  variant = 'default',
  style,
  ...textProps
}: RichTextProps) {
  const segments = useMemo(() => parseRichTextSegments(text, { variant }), [text, variant]);
  const [expandedLinks, setExpandedLinks] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setExpandedLinks({});
  }, [text, variant]);

  useEffect(() => {
    onExpandedLinksChange?.(Object.values(expandedLinks).some(Boolean));
  }, [expandedLinks, onExpandedLinksChange]);

  const handleToggleLink = useCallback((index: number) => {
    setExpandedLinks((current) => ({
      ...current,
      [index]: !current[index],
    }));
  }, []);

  return (
    <Text {...textProps} style={style}>
      {segments.map((segment, index) => {
        const isExpanded = expandedLinks[index] ?? false;

        if (segment.type === 'text') {
          return segment.text;
        }

        if (segment.type === 'mention') {
          return (
            <Text
              accessibilityRole={onMentionPress ? 'button' : undefined}
              key={`mention-${index}`}
              onPress={
                onMentionPress
                  ? (event) => {
                      event.stopPropagation?.();
                      onMentionPress(segment.text);
                    }
                  : undefined
              }
              style={styles.mention}
              suppressHighlighting
            >
              {segment.text}
            </Text>
          );
        }

        if (!segment.safe) {
          return (
            <Text key={`unsafe-link-${index}`}>
              <Text style={styles.unsafeLink}>
                {isExpanded ? segment.url : formatCollapsedRichLinkText(segment.url)}
              </Text>
              <Text
                accessibilityRole="button"
                onPress={(event) => {
                  event.stopPropagation?.();
                  handleToggleLink(index);
                }}
                style={styles.linkToggle}
                suppressHighlighting
              >
                {isExpanded ? ' v' : ' >'}
              </Text>
            </Text>
          );
        }

        return (
          <Text key={`safe-link-${index}`}>
            <Text
              accessibilityRole="link"
              style={styles.safeLink}
              onPress={(event) => {
                event.stopPropagation?.();
                void openSafeExternalUrl(segment.url);
              }}
              suppressHighlighting
            >
              {isExpanded ? segment.url : formatCollapsedRichLinkText(segment.url)}
            </Text>
            <Text
              accessibilityRole="button"
              onPress={(event) => {
                event.stopPropagation?.();
                handleToggleLink(index);
              }}
              style={styles.linkToggle}
              suppressHighlighting
            >
              {isExpanded ? ' v' : ' >'}
            </Text>
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  safeLink: {
    color: colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  unsafeLink: {
    color: colors.textSoft,
    textDecorationLine: 'line-through',
    opacity: 0.72,
  },
  linkToggle: {
    color: colors.textSoft,
    fontWeight: '700',
  },
  mention: {
    color: colors.primary,
    fontWeight: '700',
  },
});

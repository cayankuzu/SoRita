import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type HighlightedTextProps = {
  query?: string;
  text: string;
};

export function splitHighlightedText(text: string, query?: string) {
  const normalizedQuery = query?.trim().toLocaleLowerCase('tr-TR') ?? '';
  if (!normalizedQuery) return [{ highlighted: false, text }];

  const normalizedText = text.toLocaleLowerCase('tr-TR');
  const segments: Array<{ highlighted: boolean; text: string }> = [];
  let cursor = 0;

  while (cursor < text.length) {
    const matchIndex = normalizedText.indexOf(normalizedQuery, cursor);
    if (matchIndex < 0) {
      segments.push({ highlighted: false, text: text.slice(cursor) });
      break;
    }

    if (matchIndex > cursor) {
      segments.push({ highlighted: false, text: text.slice(cursor, matchIndex) });
    }
    segments.push({
      highlighted: true,
      text: text.slice(matchIndex, matchIndex + normalizedQuery.length),
    });
    cursor = matchIndex + normalizedQuery.length;
  }

  return segments.length > 0 ? segments : [{ highlighted: false, text }];
}

export function HighlightedText({ query, text }: HighlightedTextProps) {
  return (
    <>
      {splitHighlightedText(text, query).map((segment, index) => (
        <Text key={`${index}:${segment.text}`} style={segment.highlighted ? styles.highlight : undefined}>
          {segment.text}
        </Text>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  highlight: {
    backgroundColor: colors.warningBorder,
    borderRadius: radius.sm,
    color: colors.text,
  },
});

import React from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import { foldSearchText, normalizeSearchQuery } from '@/mobile/app/shared/utils/textSort';

type HighlightedTextProps = {
  query?: string;
  text: string;
};

export function splitHighlightedText(text: string, query?: string) {
  // Matches the way search does: "sukru" marks "Şükrü", "@ayse" marks "ayse".
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return [{ highlighted: false, text }];

  const normalizedText = foldSearchText(text);
  // A rare letter whose lower case is longer would shift the marks.
  if (normalizedText.length !== text.length) return [{ highlighted: false, text }];
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
        <AppText key={`${index}:${segment.text}`} style={segment.highlighted ? styles.highlight : undefined}>
          {segment.text}
        </AppText>
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

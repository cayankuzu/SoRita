import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextLayoutEventData,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { colors } from '@/mobile/app/shared/theme/tokens';

type ExpandableTextProps = {
  text: string;
  collapsedLines?: number;
  textStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  iconColor?: string;
  showIndicator?: boolean;
  renderContent?: () => React.ReactNode;
};

export function ExpandableText({
  text,
  collapsedLines = 2,
  textStyle,
  containerStyle,
  iconColor = colors.textSoft,
  showIndicator = true,
  renderContent,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [isExpandable, setIsExpandable] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  const content = useMemo(() => {
    if (renderContent) {
      return renderContent();
    }

    return text;
  }, [renderContent, text]);

  useEffect(() => {
    setExpanded(false);
  }, [collapsedLines, text, containerWidth]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setContainerWidth((current) => (current === nextWidth ? current : nextWidth));
  }, []);

  const handleMeasureLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      const nextIsExpandable = event.nativeEvent.lines.length > collapsedLines;
      setIsExpandable((current) => (current === nextIsExpandable ? current : nextIsExpandable));
    },
    [collapsedLines],
  );

  return (
    <View onLayout={handleLayout} style={[styles.wrapper, containerStyle]}>
      {containerWidth > 0 ? (
        <Text
          onTextLayout={handleMeasureLayout}
          style={[styles.text, textStyle, styles.hiddenMeasure]}
          pointerEvents="none"
        >
          {content}
        </Text>
      ) : null}

      <Pressable
        onPress={(event) => {
          event.stopPropagation?.();

          if (isExpandable) {
            setExpanded((current) => !current);
          }
        }}
        disabled={!isExpandable}
        style={styles.pressable}
      >
        <View style={styles.contentWrap}>
          <Text
            numberOfLines={expanded ? undefined : collapsedLines}
            ellipsizeMode="tail"
            style={[
              styles.text,
              textStyle,
              isExpandable && showIndicator ? styles.textWithIndicator : null,
            ]}
          >
            {content}
          </Text>

          {isExpandable && showIndicator ? (
            <View style={[styles.iconWrap, expanded ? styles.iconWrapExpanded : null]}>
              <ChevronRight color={iconColor} size={14} />
            </View>
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
    paddingRight: 18,
  },
  hiddenMeasure: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0,
    zIndex: -1,
  },
  iconWrap: {
    position: 'absolute',
    right: 0,
    top: 2,
  },
  iconWrapExpanded: {
    transform: [{ rotate: '90deg' }],
  },
});

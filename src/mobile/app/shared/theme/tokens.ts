import { Platform, type TextStyle } from 'react-native';

/**
 * The raw palette: every colour the app paints, each declared exactly once.
 * Screens never read it; they read `colors`, which names what a colour is for.
 * The neutrals are one slate ramp - a Tailwind gray border once sat beside
 * slate text, two families that never quite match.
 */
const palette = {
  white: '#ffffff',
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  // Darker than Tailwind's #64748b so it still clears AA on slate100.
  slate500: '#5a6a80',
  slate600: '#475569',
  slate900: '#0f172a',
  slate950: '#020617',
  blue50: '#eff6ff',
  blue100: '#dbeafe',
  blue200: '#bfdbfe',
  blue600: '#2563eb',
  blue700: '#1d4ed8',
  emerald50: '#ecfdf5',
  emerald200: '#a7f3d0',
  emerald700: '#047857',
  red50: '#fef2f2',
  red200: '#fecaca',
  red700: '#b91c1c',
  amber50: '#fffbeb',
  amber200: '#fde68a',
  amber700: '#b45309',
  yellow400: '#facc15',
  violet50: '#f5f3ff',
  violet700: '#6d28d9',
  sand: '#ebe7de',
};

export function withAlpha(hex: string, alpha: number) {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

export const colors = {
  background: palette.slate50,
  surface: palette.white,
  surfaceMuted: palette.slate100,
  cardBorder: palette.slate200,
  borderStrong: palette.slate300,
  focus: palette.blue600,
  text: palette.slate900,
  textMuted: palette.slate600,
  textSoft: palette.slate500,
  textDisabled: palette.slate400,
  onPrimary: palette.white,
  primary: palette.blue600,
  primaryDark: palette.blue700,
  secondary: palette.emerald700,
  danger: palette.red700,
  markerDraft: palette.yellow400,
  warning: palette.amber700,
  purple: palette.violet700,
  rating: palette.amber700,
  quote: palette.violet700,
  visibilityPublic: palette.emerald700,
  visibilityPrivate: palette.slate600,
  visibilityMixed: palette.blue600,
  successBg: palette.emerald50,
  primaryBg: palette.blue50,
  dangerBg: palette.red50,
  dangerBorder: palette.red200,
  warningBg: palette.amber50,
  warningBorder: palette.amber200,
  purpleBg: palette.violet50,
  infoBorder: palette.blue200,
  successBorder: palette.emerald200,
  // One fallback behind every cover image - profile, public profile and
  // discovery tile all render the same placeholder.
  coverFallback: palette.blue100,
  mapBackground: palette.sand,
  deepBackground: palette.slate950,
  // Dark glass under controls and badges drawn over photos and video.
  darkOverlay: withAlpha(palette.slate900, 0.72),
  // Dims the screen behind a sheet or dialog.
  overlay: withAlpha(palette.slate900, 0.4),
  // Nearly opaque: behind fullscreen media, and over media that cannot be picked.
  scrim: withAlpha(palette.slate900, 0.9),
  // A light wash that keeps white text legible on a bright cover photo.
  imageScrim: withAlpha(palette.slate900, 0.12),
  controlsBorder: withAlpha(palette.white, 0.1),
  controlsDivider: withAlpha(palette.white, 0.2),
  onDarkMuted: withAlpha(palette.white, 0.78),
  glassSurface: withAlpha(palette.white, 0.82),
};

/**
 * A 4pt scale. The app had grown 33 distinct raw spacing values (6, 10, 14
 * and 18 among the most common), so neighbouring screens never shared a
 * rhythm. `xxs` exists only for optical nudges such as a subtitle sitting 2dp
 * under its title; layout spacing starts at `xs`.
 */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  screen: 16,
  section: 24,
  card: 12,
};

export const layout = {
  screenPadding: spacing.screen,
  headerHeight: 56,
  tabBarHeight: 60,
  tabBarPaddingTop: 6,
  tabBarPaddingBottom: 6,
  discoveryTileWidth: '48.5%' as const,
  discoveryTileHeight: 132,
  thumbnailSize: 56,
};

/**
 * Seven sizes: 12, 14, 16, 18, 20, 24, 28. The scale used to have ten,
 * including the in-between 13, 15 and 17 that make neighbouring text look
 * almost-but-not-quite the same. Secondary reading text (comments, place
 * descriptions, field helpers) moved from 13 to 14, the size it is read at in
 * every mature feed app.
 */
const typographyStyles = {
  display: { fontSize: 28, lineHeight: 36, fontWeight: '800' as const },
  headlineText: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const },
  section: { fontSize: 18, lineHeight: 24, fontWeight: '700' as const },
  inputText: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  compactTitleText: { fontSize: 16, lineHeight: 22, fontWeight: '700' as const },
  bodyText: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  readingBodyText: { fontSize: 14, lineHeight: 22, fontWeight: '400' as const },
  labelText: { fontSize: 14, lineHeight: 20, fontWeight: '700' as const },
  captionText: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
  supportingLabelText: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  metadataText: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const },
  compactBodyText: { fontSize: 12, lineHeight: 18, fontWeight: '400' as const },
} as const;

export const typography = {
  ...typographyStyles,
  // Compatibility aliases for older stylesheets. Derive them from the
  // semantic styles so changing the scale cannot leave callers on two sizes.
  screenTitle: typographyStyles.title.fontSize,
  sectionTitle: typographyStyles.section.fontSize,
  body: typographyStyles.bodyText.fontSize,
  caption: typographyStyles.captionText.fontSize,
};

export const fontWeight = {
  regular: '400',
  medium: '600',
  strong: '700',
  heavy: '800',
} as const;

/**
 * How far user font scaling may stretch a layout. Both platforms let people
 * push text to 2x, and React Native has no global default for
 * `maxFontSizeMultiplier`, so without these the cap is per call site - which
 * in practice means no cap at all.
 *
 * `content` stays generous because that is the text somebody enables large
 * type to read. `chrome` is tighter for a label that shares a fixed row with
 * an icon: the tab bar packs 52dp of content into 60dp, so an uncapped 12px
 * label pushes the icon off the bar at 1.5x.
 */
export const textScale = {
  chrome: 1.3,
  content: 1.8,
} as const;

/**
 * Font scale never shrinks a layout below its designed size, so callers that
 * size a box from the scale clamp the floor at 1 as well as the ceiling.
 */
export const clampFontScale = (fontScale: number, limit: number) =>
  Math.min(Math.max(fontScale, 1), limit);

/**
 * Every text style in the app is the same three-part composition: a step of
 * the type scale, a colour from the palette, sometimes a weight. Writing that
 * out per style left 225 hand-copied bodies across 64 files, collapsing into
 * only 23 distinct combinations - so the composition gets a name here instead
 * of each of its combinations getting one at every call site.
 */
export function textStyle(
  scale: keyof typeof typographyStyles,
  color: string,
  weight?: TextStyle['fontWeight'],
): TextStyle {
  return {
    ...typographyStyles[scale],
    color,
    ...(weight ? { fontWeight: weight } : null),
  };
}

/**
 * Equal-width digits for numbers that change in place - like counts, badges,
 * character counters - so a 9 turning into 10 does not nudge its neighbours.
 */
export const tabularNumbers: TextStyle = { fontVariant: ['tabular-nums'] };

export const letterSpacing = {
  brandTitle: -0.8,
  brandTagline: 0.4,
  emphasizedMetadata: 0.1,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  pill: 999,
};

export const touch = {
  ios: 44,
  android: 48,
} as const;

/**
 * The painted minimum for a control that carries its whole target in its box
 * rather than in `hitSlop`. `IconButton` derived this locally while every other
 * control hardcoded 44 — the iOS number — so those controls were 4dp short of
 * Material's floor on Android. One derivation, one place.
 */
export const minTouchSize = Platform.OS === 'ios' ? touch.ios : touch.android;

// Icon-sized controls stay visually small on purpose; this is the invisible
// padding they need so the *effective* target still reaches the platform
// minimum. Callers pass the painted box, not a magic number.
//
// The default is the Android floor, which is the larger of the two, so one
// control does not have two behaviours. Defaulting to `touch.ios` left every
// caller that took the default 4dp short on Android — and every caller took the
// default. A slightly generous target on iOS costs nothing; a short one on
// Android is a control the user has to aim at.
export const hitSlopFor = (renderedSize: number, minimum: number = touch.android) =>
  Math.max(0, Math.ceil((minimum - renderedSize) / 2));

export const controlSize = {
  // A static badge; never a touch target on its own.
  badge: 24,
  compact: 32,
  // An icon-only action in a row of them: a 20dp glyph with 8dp either side,
  // reaching the 48dp floor through hit slop.
  icon: 36,
  // A selectable chip: painted at 36 so a row of them stays light, reaching
  // the 48dp floor through hit slop.
  chip: 36,
  default: 44,
  large: 48,
} as const;

/**
 * One disabled value. Nine controls had picked their own, from 0.45 to 0.72,
 * so a disabled button read differently on every screen.
 */
export const opacity = {
  disabled: 0.5,
  pressed: 0.9,
  muted: 0.72,
} as const;

/**
 * Stacking layers, lowest to highest. `raised` and `overlay` order siblings
 * inside one component; `floating` lifts map chrome over the map; `system` is
 * for the toast and the offline banner, which sit above everything.
 */
export const zIndex = {
  behind: -1,
  raised: 1,
  overlay: 2,
  floating: 10,
  system: 1000,
} as const;

/**
 * Six icon sizes. 280 icons had been sized by hand at 17 different values, so
 * the same glyph rendered at 13, 14 and 16 on neighbouring screens. `xs` is
 * for glyphs inside a chip or badge, `sm` beside body text, `md` for a
 * control, `lg` for a primary action, `xl` and `xxl` for empty states.
 */
export const iconSize = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

/**
 * Three avatar sizes. Seven had grown, from 16 to 42, and the 16dp one printed
 * its initials at 4px. `xs` sits inline with metadata, `sm` heads a card, a
 * reply or the comment composer, `md` leads a list row or a comment.
 */
export const avatarSize = {
  xs: 24,
  sm: 32,
  md: 40,
} as const;

export const contentWidth = {
  form: 480,
  feed: 620,
  settings: 660,
  sheet: 700,
} as const;

function shadow(opacity: number, blur: number, offsetY: number, androidElevation: number) {
  return {
    shadowColor: palette.slate900,
    shadowOpacity: opacity,
    shadowRadius: blur,
    shadowOffset: { width: 0, height: offsetY },
    elevation: androidElevation,
  };
}

/**
 * Four levels, and nothing writes its own shadow. The tokens used to put a 12%
 * alpha in `shadowColor` and multiply it again by `shadowOpacity`, so on iOS
 * every shadow came out at about 2% and never showed; meanwhile nine styles
 * hand-rolled their own. The ink is now opaque and `shadowOpacity` alone sets
 * the strength on iOS; Android draws from `elevation`.
 */
export const elevation = {
  // A surface resting on the canvas.
  card: shadow(0.06, 12, 4, 2),
  // Controls floating over content or the map: search bar, buttons, toast.
  floating: shadow(0.12, 14, 6, 6),
  modal: shadow(0.18, 18, 10, 8),
  // A small object on the map that has to lift off busy tiles.
  marker: shadow(0.2, 6, 4, 6),
} as const;

export const motion = {
  fast: 120,
  standard: 180,
  slow: 260,
  easing: {
    standard: 'ease-out',
  },
} as const;

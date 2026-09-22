import { Platform, type TextStyle } from 'react-native';

export const colors = {
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceMuted: '#f1f5f9',
  surfaceRaised: '#ffffff',
  cardBorder: '#e5e7eb',
  borderStrong: '#cbd5e1',
  focus: '#2563eb',
  text: '#0f172a',
  textMuted: '#475569',
  textSoft: '#5a6a80',
  textDisabled: '#94a3b8',
  textInverse: '#ffffff',
  onPrimary: '#ffffff',
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  secondary: '#047857',
  danger: '#b91c1c',
  markerDraft: '#facc15',
  warning: '#b45309',
  warningText: '#b45309',
  purple: '#6d28d9',
  social: '#047857',
  rating: '#b45309',
  quote: '#6d28d9',
  visibilityPublic: '#047857',
  visibilityPrivate: '#475569',
  visibilityMixed: '#2563eb',
  successBg: '#ecfdf5',
  primaryBg: '#eff6ff',
  dangerBg: '#fef2f2',
  dangerBorder: '#fecaca',
  warningBg: '#fffbeb',
  warningBorder: '#fde68a',
  purpleBg: '#f5f3ff',
  infoBorder: '#bfdbfe',
  successBorder: '#a7f3d0',
  // One fallback behind every cover image - profile, public profile and
  // discovery tile all render the same placeholder.
  coverFallback: '#dbeafe',
  darkOverlay: 'rgba(15, 23, 42, 0.7)',
  lightboxOverlay: 'rgba(15, 23, 42, 0.92)',
  lightboxChrome: 'rgba(5, 10, 19, 0.78)',
  lightboxDeep: '#040811',
  overlay: 'rgba(15, 23, 42, 0.4)',
  controlsOverlay: 'rgba(15, 23, 42, 0.72)',
  controlsBorder: 'rgba(255, 255, 255, 0.1)',
  controlsDivider: 'rgba(255, 255, 255, 0.22)',
  onDarkMuted: 'rgba(255, 255, 255, 0.78)',
  onDarkFaint: 'rgba(233, 240, 255, 0.72)',
  deepBackground: '#020617',
  deepBorder: 'rgba(255, 255, 255, 0.08)',
  mediaPickerOverlay: 'rgba(15, 23, 42, 0.84)',
  shadowSubtle: 'rgba(15, 23, 42, 0.12)',
  cameraBorder: 'rgba(255, 255, 255, 0.18)',
  cameraBackground: '#000000',
  glassSurface: 'rgba(255, 255, 255, 0.82)',
  mapBackground: '#ebe7de',
  onDarkSubtle: 'rgba(255, 255, 255, 0.72)',
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

export const semanticColors = {
  content: {
    primary: colors.text,
    secondary: colors.textMuted,
    muted: colors.textSoft,
    disabled: colors.textDisabled,
    inverse: colors.textInverse,
  },
  action: {
    primary: colors.primary,
    primaryPressed: colors.primaryDark,
    success: colors.secondary,
    danger: colors.danger,
    disabled: colors.surfaceMuted,
  },
  brand: {
    primary: colors.primary,
    secondary: colors.secondary,
  },
  social: {
    primary: colors.social,
    background: colors.successBg,
  },
  visibility: {
    public: colors.visibilityPublic,
    private: colors.visibilityPrivate,
    mixed: colors.visibilityMixed,
  },
  accent: {
    rating: colors.rating,
    quote: colors.quote,
  },
  surface: {
    canvas: colors.background,
    card: colors.surface,
    subtle: colors.surfaceMuted,
    raised: colors.surfaceRaised,
    overlay: colors.overlay,
  },
  border: {
    default: colors.cardBorder,
    strong: colors.borderStrong,
    focus: colors.focus,
    danger: colors.danger,
    success: colors.secondary,
  },
  state: {
    infoBg: colors.primaryBg,
    infoText: colors.primaryDark,
    successBg: colors.successBg,
    successText: colors.secondary,
    warningBg: colors.warningBg,
    warningText: colors.warningText,
    dangerBg: colors.dangerBg,
    dangerText: colors.danger,
    purpleBg: colors.purpleBg,
    purpleText: colors.purple,
  },
} as const;

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
  compact: 32,
  default: 44,
  large: 48,
} as const;

export const opacity = {
  disabled: 0.62,
  pressed: 0.9,
  muted: 0.72,
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

export const contentWidth = {
  form: 480,
  feed: 620,
  settings: 660,
  sheet: 700,
} as const;

export const elevation = {
  card: {
    shadowColor: colors.shadowSubtle,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  floating: {
    shadowColor: colors.shadowSubtle,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  modal: {
    shadowColor: colors.shadowSubtle,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;

export const motion = {
  fast: 120,
  standard: 180,
  slow: 260,
  easing: {
    standard: 'ease-out',
  },
} as const;

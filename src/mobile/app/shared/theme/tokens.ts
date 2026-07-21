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
  textSoft: '#64748b',
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
  dangerBorderSubtle: 'rgba(239, 68, 68, 0.22)',
  warningBg: '#fffbeb',
  warningBorder: '#fde68a',
  purpleBg: '#f5f3ff',
  infoBorder: '#bfdbfe',
  successBorder: '#a7f3d0',
  successBorderSubtle: 'rgba(16, 185, 129, 0.22)',
  profileCoverFallback: '#dbeafe',
  ownProfileCover: '#dbeafe',
  publicProfileCover: '#dbeafe',
  userCoverFallback: '#dbeafe',
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

export const spacing = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 10,
  lg: 12,
  xl: 18,
  '2xl': 24,
  screen: 12,
  section: 16,
  card: 10,
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

export const typography = {
  display: { fontSize: 24, lineHeight: 29, fontWeight: '800' as const },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '700' as const },
  section: { fontSize: 16, lineHeight: 21, fontWeight: '700' as const },
  bodyText: { fontSize: 13, lineHeight: 19, fontWeight: '400' as const },
  labelText: { fontSize: 12, lineHeight: 17, fontWeight: '700' as const },
  captionText: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  metadataText: { fontSize: 12, lineHeight: 15, fontWeight: '600' as const },
  compactCardTitleText: { fontSize: 11, lineHeight: 14, fontWeight: '700' as const },
  compactCardMetaText: { fontSize: 10, lineHeight: 13, fontWeight: '600' as const },
  screenTitle: 18,
  sectionTitle: 16,
  body: 13,
  caption: 12,
  micro: 12,
};

export const fontWeight = {
  regular: '400',
  medium: '600',
  strong: '700',
  heavy: '800',
} as const;

export const radius = {
  sm: 8,
  md: 11,
  lg: 15,
  xl: 20,
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

export const iconSize = {
  sm: 14,
  md: 18,
  lg: 20,
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

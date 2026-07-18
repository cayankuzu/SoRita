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
  successBg: '#ecfdf5',
  primaryBg: '#eff6ff',
  dangerBg: '#fef2f2',
  warningBg: '#fffbeb',
  purpleBg: '#f5f3ff',
  ownProfileCover: '#60a5fa',
  publicProfileCover: '#f9a8d4',
  userCoverFallback: '#dbeafe',
  darkOverlay: 'rgba(15, 23, 42, 0.7)',
  lightboxOverlay: 'rgba(15, 23, 42, 0.92)',
  overlay: 'rgba(15, 23, 42, 0.4)',
  controlsOverlay: 'rgba(15, 23, 42, 0.72)',
  controlsBorder: 'rgba(255, 255, 255, 0.1)',
  onDarkMuted: 'rgba(255, 255, 255, 0.78)',
  deepBackground: '#020617',
  deepBorder: 'rgba(255, 255, 255, 0.08)',
  mediaPickerOverlay: 'rgba(15, 23, 42, 0.84)',
  shadowSubtle: 'rgba(15, 23, 42, 0.12)',
  cameraBorder: 'rgba(255, 255, 255, 0.18)',
  cameraBackground: '#000000',
  mapBackground: '#ebe7de',
  onDarkSubtle: 'rgba(255, 255, 255, 0.72)',
};

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  screen: 16,
  section: 20,
  card: 14,
};

export const layout = {
  screenPadding: spacing.screen,
  headerHeight: 76,
  tabBarHeight: 68,
  tabBarPaddingTop: 8,
  tabBarPaddingBottom: 8,
  discoveryTileWidth: '48.5%' as const,
  discoveryTileHeight: 176,
  thumbnailSize: 64,
};

export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '800' as const },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800' as const },
  section: { fontSize: 18, lineHeight: 24, fontWeight: '800' as const },
  bodyText: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  labelText: { fontSize: 14, lineHeight: 20, fontWeight: '700' as const },
  captionText: { fontSize: 12, lineHeight: 17, fontWeight: '500' as const },
  metadataText: { fontSize: 11, lineHeight: 15, fontWeight: '600' as const },
  screenTitle: 22,
  sectionTitle: 18,
  body: 14,
  caption: 12,
  micro: 11,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
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

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
} as const;

export const contentWidth = {
  form: 520,
  feed: 680,
  settings: 720,
  sheet: 760,
} as const;

export const elevation = {
  card: {
    shadowColor: colors.shadowSubtle,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  floating: {
    shadowColor: colors.shadowSubtle,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  modal: {
    shadowColor: colors.shadowSubtle,
    shadowOpacity: 0.2,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
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

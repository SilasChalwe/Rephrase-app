const hexToRgb = (hex) => {
  const normalized = String(hex || '').replace('#', '').trim();
  const fullHex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((value) => `${value}${value}`)
          .join('')
      : normalized;

  const value = Number.parseInt(fullHex, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

export const withOpacity = (hex, opacity) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const palette = {
  navy950: '#081A33',
  navy900: '#0F2748',
  navy800: '#17355F',
  navy700: '#214574',
  orange500: '#F6A563',
  orange400: '#FFD6AE',
  orange300: '#FEE9D1',
  white: '#FFFFFF',
  slate50: '#F4F7FB',
  slate100: '#E8EEF6',
  slate200: '#D5DEEA',
  slate400: '#8A97AE',
  slate500: '#64728C',
  success: '#62C47C',
  danger: '#FF8A80',
  black: '#000000',
};

export const appTheme = {
  colors: {
    background: palette.navy950,
    backgroundAlt: palette.navy900,
    primary: palette.navy800,
    primarySoft: palette.navy700,
    accent: palette.orange500,
    accentSoft: palette.orange400,
    accentSurface: palette.orange300,
    surface: palette.slate50,
    surfaceMuted: palette.slate100,
    surfaceBorder: palette.slate200,
    card: palette.white,
    text: '#13284A',
    textMuted: palette.slate500,
    textOnDark: '#F7FAFF',
    textOnDarkMuted: withOpacity(palette.white, 0.72),
    textOnDarkSoft: withOpacity(palette.white, 0.48),
    borderOnDark: withOpacity(palette.white, 0.16),
    borderOnDarkSoft: withOpacity(palette.white, 0.12),
    success: palette.success,
    danger: palette.danger,
    shadow: withOpacity(palette.black, 0.24),
  },
  auth: {
    screen: palette.navy950,
    card: withOpacity(palette.white, 0.08),
    cardBorder: withOpacity(palette.white, 0.16),
    input: withOpacity(palette.white, 0.10),
    inputBorder: withOpacity(palette.white, 0.14),
    readonly: withOpacity(palette.white, 0.08),
    readonlyBorder: withOpacity(palette.white, 0.10),
    button: palette.orange500,
    buttonText: palette.navy950,
    link: palette.orange400,
  },
  chat: {
    screen: palette.navy950,
    header: palette.navy900,
    bubbleMine: '#F3A566',
    bubbleMineText: palette.navy950,
    bubbleMineMeta: withOpacity(palette.navy950, 0.64),
    bubbleTheirs: palette.navy800,
    bubbleTheirsText: '#F7FAFF',
    bubbleTheirsMeta: withOpacity(palette.white, 0.72),
    senderName: palette.orange400,
    composer: withOpacity(palette.white, 0.10),
    composerBorder: withOpacity(palette.white, 0.14),
    sendButton: palette.orange500,
    sendButtonDisabled: withOpacity(palette.orange500, 0.45),
    datePill: withOpacity(palette.black, 0.35),
    datePillText: '#F7FAFF',
    unreadBg: palette.orange300,
    unreadBorder: withOpacity(palette.orange500, 0.48),
    unreadText: '#9B551E',
    floatingButton: palette.navy800,
    floatingBadge: palette.orange500,
    floatingBadgeText: '#4B2608',
    typingBubble: palette.navy800,
    typingDot: palette.orange400,
    attachmentSurface: withOpacity(palette.black, 0.15),
    mediaSurface: '#112546',
  },
  tabs: {
    bar: palette.navy900,
    active: palette.orange500,
    inactive: withOpacity(palette.white, 0.62),
  },
  modal: {
    surface: palette.white,
    panel: palette.slate50,
    border: palette.slate200,
    accent: palette.orange500,
    accentSoft: palette.orange300,
    text: '#13284A',
    textMuted: palette.slate500,
  },
};

export const custom_colors = {
  primary_dark: appTheme.colors.primary,
  primary_light: appTheme.colors.primarySoft,
  primary_aut: appTheme.colors.accent,
  peimary_aut: appTheme.colors.accent,
  secondary: appTheme.colors.surface,
};

export default appTheme;

export const colors = {
  primary: '#5B4FE9',
  primaryDark: '#4338CA',
  primaryLight: '#EEF0FF',
  gradientStart: '#4F46E5',
  gradientEnd: '#6D28D9',

  background: '#F7F7FB',
  card: '#FFFFFF',

  text: '#1F2130',
  textSecondary: '#8A8DA0',
  textMuted: '#B4B6C4',
  border: '#EBEBF2',

  success: '#22C55E',
  danger: '#EF4444',
  warning: '#F5A524',
  pink: '#F65C93',
  blue: '#3B82F6',

  white: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700', color: colors.text },
  h2: { fontSize: 22, fontWeight: '700', color: colors.text },
  h3: { fontSize: 18, fontWeight: '600', color: colors.text },
  body: { fontSize: 15, fontWeight: '400', color: colors.text },
  bodyMuted: { fontSize: 14, fontWeight: '400', color: colors.textSecondary },
  caption: { fontSize: 12, fontWeight: '400', color: colors.textMuted },
  button: { fontSize: 16, fontWeight: '600', color: colors.white },
};

// Per reminder "type" accent colors, reused across Add Reminder, Medicine
// Reminder, Calendar and Notifications screens so a type always looks the same.
export const reminderTypeStyles = {
  medicine: { color: colors.blue, bg: '#E8F0FE', icon: 'pill' },
  birthday: { color: colors.pink, bg: '#FDE8F0', icon: 'cake-variant' },
  anniversary: { color: colors.danger, bg: '#FDE9E9', icon: 'heart' },
  note: { color: colors.warning, bg: '#FDF3E1', icon: 'note-text' },
  task: { color: colors.success, bg: '#E7F8ED', icon: 'checkbox-marked-circle-outline' },
  custom: { color: colors.primary, bg: colors.primaryLight, icon: 'clock-outline' },
  recharge: { color: '#0EA5E9', bg: '#E0F2FE', icon: 'sim' },
  event: { color: '#7C3AED', bg: '#EFE9FE', icon: 'calendar-account-outline' },
  alarm: { color: '#DC2626', bg: '#FDE9E9', icon: 'alarm' },
};

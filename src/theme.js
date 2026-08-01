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
  // type 'note' was the Business "Message" feature, removed - every
  // listing query now excludes it server-side (see reminders.service.js),
  // so nothing should render this anymore. Left as a harmless fallback
  // rather than deleted outright, in case an old cached list somewhere
  // still has one. Not to be confused with the plain personal Notes tile
  // on Home, which isn't a reminder at all (separate `notes` table, no
  // type field) and keeps its own distinct icon defined inline in home.js.
  note: { color: '#1D4ED8', bg: '#DBEAFE', icon: 'message-text-outline' },
  task: { color: colors.success, bg: '#E7F8ED', icon: 'checkbox-marked-circle-outline' },
  custom: { color: colors.primary, bg: colors.primaryLight, icon: 'clock-outline' },
  recharge: { color: '#0EA5E9', bg: '#E0F2FE', icon: 'sim' },
  event: { color: '#7C3AED', bg: '#EFE9FE', icon: 'calendar-account-outline' },
  alarm: { color: '#DC2626', bg: '#FDE9E9', icon: 'alarm' },
  company: { color: '#0F766E', bg: '#E1F4F1', icon: 'domain' },
};

// Accent colors for the Company -> Project -> Group hierarchy screens -
// these aren't reminder "types" (group reminders keep type "company" above
// and get that icon for free), just card/icon styling for the browsing UI.
export const hierarchyStyles = {
  company: { color: '#0F766E', bg: '#E1F4F1', icon: 'domain' },
  project: { color: '#6D28D9', bg: '#EFE9FE', icon: 'folder-outline' },
  group: { color: '#0891B2', bg: '#E0F7FA', icon: 'account-group' },
};

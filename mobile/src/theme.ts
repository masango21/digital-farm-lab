export const colors = {
  primary: '#2F6B2F',
  primaryDark: '#1F4D1F',
  primaryLight: '#E8F3E3',
  accent: '#E9A23B',
  water: '#2E86C1',
  waterLight: '#E3F0FA',
  danger: '#C0392B',
  dangerLight: '#FBE3E0',
  warning: '#A86A0C',
  warningLight: '#FDF4D8',
  success: '#1E8449',
  text: '#1A261A',
  textMuted: '#5F6E5F',
  border: '#E1E7DE',
  background: '#F5F7F3',
  card: '#FFFFFF',
  white: '#FFFFFF',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };

/** Soft elevation used by cards (cross-platform boxShadow). */
export const shadow = {
  card: { boxShadow: '0px 1px 2px rgba(20, 40, 20, 0.05), 0px 4px 14px rgba(20, 40, 20, 0.05)' },
  raised: { boxShadow: '0px 6px 20px rgba(20, 40, 20, 0.18)' },
} as const;

export const gradeColor = (grade: string) =>
  ({ A: colors.success, B: '#58A23C', C: colors.accent, D: colors.warning, F: colors.danger })[grade] ?? colors.textMuted;

export const scoreColor = (score: number) =>
  score >= 80 ? colors.success : score >= 60 ? colors.accent : score >= 40 ? colors.warning : colors.danger;

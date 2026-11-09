export const colors = {
  primary: '#2F6B2F',
  primaryDark: '#1F4D1F',
  primaryLight: '#E8F3E3',
  accent: '#E9A23B',
  water: '#2E86C1',
  waterLight: '#D6EAF8',
  danger: '#C0392B',
  dangerLight: '#FADBD8',
  warning: '#B9770E',
  warningLight: '#FCF3CF',
  success: '#1E8449',
  text: '#1D2A1D',
  textMuted: '#5B6B5B',
  border: '#D5DDD2',
  background: '#F4F7F2',
  card: '#FFFFFF',
  white: '#FFFFFF',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 };

export const gradeColor = (grade: string) =>
  ({ A: colors.success, B: '#58A23C', C: colors.accent, D: colors.warning, F: colors.danger })[grade] ?? colors.textMuted;

export const scoreColor = (score: number) =>
  score >= 80 ? colors.success : score >= 60 ? colors.accent : score >= 40 ? colors.warning : colors.danger;

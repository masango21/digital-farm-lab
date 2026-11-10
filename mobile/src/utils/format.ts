/** "R 12 345" / "−R 9 586", with non-breaking spaces so amounts never wrap. */
export const formatRand = (v: number) => {
  const n = Math.round(v);
  return `${n < 0 ? '−' : ''}R ${Math.abs(n).toLocaleString('en-ZA').replace(/\s/g, ' ')}`;
};

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function gradeFor(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  return score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : score >= 50 ? 'D' : 'F';
}

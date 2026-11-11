import type { GradeRule } from '../types/marks';

interface GradeBadgeProps {
  grade: GradeRule;
  size?: 'sm' | 'md';
}

const COLOR_STYLES: Record<GradeRule['color'], string> = {
  emerald:
    'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  indigo:
    'bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30',
  amber:
    'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  orange:
    'bg-orange-50 text-orange-700 border-orange-200/80 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30',
  rose:
    'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
};

export function GradeBadge({ grade, size = 'sm' }: GradeBadgeProps) {
  const sizeClass =
    size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border font-semibold tabular-nums ${sizeClass} ${COLOR_STYLES[grade.color]}`}
    >
      {grade.label}
    </span>
  );
}

export function getPctTextColor(pct: number, targetPct: number, passingPct: number): string {
  if (pct >= targetPct) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= passingPct) return 'text-slate-900 dark:text-slate-100';
  return 'text-rose-600 dark:text-rose-400';
}

export function getBarColor(pct: number, targetPct: number, passingPct: number): string {
  if (pct >= targetPct) return 'bg-emerald-500';
  if (pct >= passingPct + (targetPct - passingPct) * 0.5) return 'bg-indigo-500';
  if (pct >= passingPct) return 'bg-amber-500';
  return 'bg-rose-500';
}


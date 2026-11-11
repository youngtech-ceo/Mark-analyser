import type { AppSettings, GradeRule } from '../types/marks';

export const DEFAULT_GRADE_SCALE: GradeRule[] = [
  { label: 'A+', minPercentage: 90, color: 'emerald' },
  { label: 'A', minPercentage: 80, color: 'emerald' },
  { label: 'B+', minPercentage: 70, color: 'indigo' },
  { label: 'B', minPercentage: 60, color: 'indigo' },
  { label: 'C', minPercentage: 50, color: 'amber' },
  { label: 'D', minPercentage: 40, color: 'orange' },
  { label: 'F', minPercentage: 0, color: 'rose' },
];

export const DEFAULT_SETTINGS: AppSettings = {
  targetPercentage: 85,
  passingPercentage: 40,
  theme: 'light',
  gradeScale: DEFAULT_GRADE_SCALE,
};

export const EXAM_CATEGORIES = [
  'Unit Test',
  'Mid-Term',
  'Final Exam',
  'Mock Test',
  'Lab / Practical',
  'Assignment / Quiz',
  'Semester Exam',
];

export const QUICK_TOTAL_MARKS = [20, 25, 30, 50, 70, 80, 100];

export function createId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateVaultKey(): string {
  const words = ['APEX', 'NOVA', 'PULSE', 'DELTA', 'ZENITH', 'SOLAR', 'ORBIT', 'PRISM'];
  const word = words[Math.floor(Math.random() * words.length)];
  const code = Math.random().toString(36).substring(2, 6).toUpperCase();
  const num = Math.floor(10 + Math.random() * 89);
  return `${word}-${code}-${num}`;
}


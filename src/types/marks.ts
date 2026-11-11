export interface SubjectMark {
  id: string;
  name: string;
  scoredMarks: number;
  totalMarks: number;
  notes?: string;
}

export interface Exam {
  id: string;
  name: string;
  date: string; // ISO YYYY-MM-DD
  category: string; // e.g., 'Unit Test', 'Mid-Term', 'Final', 'Mock Test', 'Lab'
  defaultTotalMarks: number;
  notes?: string;
  subjects: SubjectMark[];
  createdAt: number;
  updatedAt: number;
  isSample?: boolean;
}

export interface GradeRule {
  label: string;
  minPercentage: number;
  color: 'emerald' | 'indigo' | 'amber' | 'orange' | 'rose';
}

export interface AppSettings {
  targetPercentage: number;
  passingPercentage: number;
  theme: 'light' | 'dark';
  gradeScale: GradeRule[];
}

export interface UserMarkStore {
  exams: Exam[];
  settings: AppSettings;
  updatedAt: number;
}

export type CloudStatus =
  | 'connecting'
  | 'synced'
  | 'syncing'
  | 'offline'
  | 'permission-denied'
  | 'error';

export type SyncMode = 'vault' | 'account';

export interface CloudConnectionInfo {
  mode: SyncMode;
  vaultKey: string;
  userEmail: string | null;
  userId: string | null;
  status: CloudStatus;
  lastSyncedAt: number | null;
  errorMessage: string | null;
}

export interface ExamSummary {
  exam: Exam;
  totalScored: number;
  totalMax: number;
  percentage: number;
  grade: GradeRule;
  subjectCount: number;
  passedCount: number;
  failedCount: number;
  highestSubject: SubjectMark | null;
  lowestSubject: SubjectMark | null;
  deltaFromPrevious: number | null;
}

export interface SubjectStats {
  key: string; // canonical lowercased key
  displayName: string;
  appearances: number;
  totalScored: number;
  totalMax: number;
  weightedAveragePct: number;
  simpleAveragePct: number;
  bestPct: number;
  bestExamName: string;
  lowestPct: number;
  lowestExamName: string;
  latestPct: number;
  previousPct: number | null;
  trendDelta: number | null; // latest minus previous (or second half vs first half)
  slopePerExam: number; // linear regression slope
  stdDevPct: number;
  targetGapPct: number; // weightedAveragePct - targetPercentage
  passRatePct: number;
  history: Array<{
    examId: string;
    examName: string;
    date: string;
    scoredMarks: number;
    totalMarks: number;
    percentage: number;
    notes?: string;
  }>;
}

export interface InsightItem {
  id: string;
  kind: 'positive' | 'warning' | 'opportunity' | 'info';
  title: string;
  description: string;
  metric?: string;
}

export interface OverallAnalytics {
  examCount: number;
  totalSubjectEntries: number;
  uniqueSubjectCount: number;
  totalScored: number;
  totalMax: number;
  weightedOverallPct: number;
  unweightedExamAvgPct: number;
  consistencyStdDev: number;
  consistencyLabel: 'Very Steady' | 'Consistent' | 'Moderate Variance' | 'Volatile';
  trendSlopePerExam: number;
  recentMomentumDelta: number | null;
  bestExam: ExamSummary | null;
  lowestExam: ExamSummary | null;
  bestSubject: SubjectStats | null;
  focusSubject: SubjectStats | null;
  passRatePct: number;
  examSummaries: ExamSummary[]; // chronological (oldest -> newest)
  subjectStats: SubjectStats[]; // sorted by weightedAveragePct descending
  insights: InsightItem[];
  regressionLine: Array<{
    examId: string;
    examName: string;
    date: string;
    actualPct: number;
    trendPct: number;
  }>;
}


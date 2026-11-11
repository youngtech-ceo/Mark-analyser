import type { Exam } from '../types/marks';

export function buildSampleExams(): Exam[] {
  const base = Date.now() - 1000 * 60 * 60 * 24 * 90;
  return [
    {
      id: 'sample_exam_1',
      name: 'Unit Test 1',
      date: '2026-07-14',
      category: 'Unit Test',
      defaultTotalMarks: 25,
      notes: 'Early diagnostic assessment — struggled with Calculus timing.',
      createdAt: base,
      updatedAt: base,
      isSample: true,
      subjects: [
        { id: 's1_math', name: 'Mathematics', scoredMarks: 17, totalMarks: 25, notes: 'Ran out of time' },
        { id: 's1_phys', name: 'Physics', scoredMarks: 19, totalMarks: 25 },
        { id: 's1_chem', name: 'Chemistry', scoredMarks: 21, totalMarks: 25 },
        { id: 's1_cs', name: 'Computer Science', scoredMarks: 22, totalMarks: 25 },
        { id: 's1_eng', name: 'English', scoredMarks: 20, totalMarks: 25 },
      ],
    },
    {
      id: 'sample_exam_2',
      name: 'Unit Test 2',
      date: '2026-08-18',
      category: 'Unit Test',
      defaultTotalMarks: 50,
      notes: 'Better pacing in Math; Organic Chemistry reactions needed revision.',
      createdAt: base + 1000 * 60 * 60 * 24 * 30,
      updatedAt: base + 1000 * 60 * 60 * 24 * 30,
      isSample: true,
      subjects: [
        { id: 's2_math', name: 'Mathematics', scoredMarks: 38, totalMarks: 50 },
        { id: 's2_phys', name: 'Physics', scoredMarks: 41, totalMarks: 50 },
        { id: 's2_chem', name: 'Chemistry', scoredMarks: 37, totalMarks: 50, notes: 'Organic section weak' },
        { id: 's2_cs', name: 'Computer Science', scoredMarks: 45, totalMarks: 50 },
        { id: 's2_eng', name: 'English', scoredMarks: 42, totalMarks: 50 },
      ],
    },
    {
      id: 'sample_exam_3',
      name: 'Mid-Term Examination',
      date: '2026-09-24',
      category: 'Mid-Term',
      defaultTotalMarks: 80,
      notes: 'Theory papers out of 80 + practical lab assessment out of 30.',
      createdAt: base + 1000 * 60 * 60 * 24 * 60,
      updatedAt: base + 1000 * 60 * 60 * 24 * 60,
      isSample: true,
      subjects: [
        { id: 's3_math', name: 'Mathematics', scoredMarks: 66, totalMarks: 80 },
        { id: 's3_phys', name: 'Physics', scoredMarks: 68, totalMarks: 80 },
        { id: 's3_chem', name: 'Chemistry', scoredMarks: 65, totalMarks: 80 },
        { id: 's3_cs', name: 'Computer Science', scoredMarks: 74, totalMarks: 80 },
        { id: 's3_eng', name: 'English', scoredMarks: 67, totalMarks: 80 },
        { id: 's3_lab', name: 'Physics Lab', scoredMarks: 27, totalMarks: 30 },
      ],
    },
    {
      id: 'sample_exam_4',
      name: 'Pre-Final Mock',
      date: '2026-10-28',
      category: 'Mock Test',
      defaultTotalMarks: 100,
      notes: 'Full syllabus 100-mark simulation. Strong improvement in Mathematics!',
      createdAt: base + 1000 * 60 * 60 * 24 * 80,
      updatedAt: base + 1000 * 60 * 60 * 24 * 80,
      isSample: true,
      subjects: [
        { id: 's4_math', name: 'Mathematics', scoredMarks: 86, totalMarks: 100, notes: 'Much faster problem solving' },
        { id: 's4_phys', name: 'Physics', scoredMarks: 88, totalMarks: 100 },
        { id: 's4_chem', name: 'Chemistry', scoredMarks: 81, totalMarks: 100 },
        { id: 's4_cs', name: 'Computer Science', scoredMarks: 95, totalMarks: 100 },
        { id: 's4_eng', name: 'English', scoredMarks: 84, totalMarks: 100 },
        { id: 's4_lab', name: 'Physics Lab', scoredMarks: 28, totalMarks: 30 },
      ],
    },
  ];
}


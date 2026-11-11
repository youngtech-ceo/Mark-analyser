const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./analytics.js');

test('calcPercentage handles zero and negative totals safely', () => {
  assert.equal(A.calcPercentage(50, 0), 0);
  assert.equal(A.calcPercentage(40, -10), 0);
  assert.equal(A.calcPercentage(45, 50), 90);
});

test('analyzeMarks handles varying total marks and canonical subject grouping', () => {
  const exams = [
    {
      id: 'e2',
      name: 'Mid Term',
      date: '2026-09-10',
      category: 'Mid-Term',
      defaultTotalMarks: 100,
      createdAt: 200,
      updatedAt: 200,
      subjects: [
        { id: 's3', name: 'Math', scoredMarks: 85, totalMarks: 100 },
        { id: 's4', name: 'Physics Lab', scoredMarks: 27, totalMarks: 30 },
      ],
    },
    {
      id: 'e1',
      name: 'Unit Test 1',
      date: '2026-08-01',
      category: 'Unit Test',
      defaultTotalMarks: 50,
      createdAt: 100,
      updatedAt: 100,
      subjects: [
        { id: 's1', name: ' math  ', scoredMarks: 35, totalMarks: 50 },
        { id: 's2', name: 'Physics Lab', scoredMarks: 16, totalMarks: 20 },
      ],
    },
  ];

  const res = A.analyzeMarks(exams, A.DEFAULT_SETTINGS);
  assert.equal(res.examCount, 2);
  assert.equal(res.examSummaries[0].exam.id, 'e1');
  assert.equal(res.examSummaries[1].exam.id, 'e2');
  assert.equal(res.totalScored, 163);
  assert.equal(res.totalMax, 200);
  assert.ok(Math.abs(res.weightedOverallPct - 81.5) < 0.01);
  assert.equal(res.uniqueSubjectCount, 2);

  const math = res.subjectStats.find((s) => s.key === 'math');
  assert.ok(math);
  assert.equal(math.appearances, 2);
  assert.equal(math.totalScored, 120);
  assert.equal(math.totalMax, 150);
  assert.ok(Math.abs(math.weightedAveragePct - 80) < 0.01);
});

test('predictRequiredScore covers all feasibility outcomes', () => {
  const achievable = A.predictRequiredScore({
    currentScored: 160,
    currentMax: 200,
    upcomingMax: 100,
    targetPct: 83,
  });
  assert.equal(achievable.status, 'achievable');
  assert.ok(Math.abs(achievable.requiredMarks - 89) < 0.01);

  const met = A.predictRequiredScore({
    currentScored: 180,
    currentMax: 200,
    upcomingMax: 50,
    targetPct: 70,
  });
  assert.equal(met.status, 'already-met');
  assert.equal(met.requiredMarks, 0);

  const multi = A.predictRequiredScore({
    currentScored: 120,
    currentMax: 200,
    upcomingMax: 100,
    targetPct: 85,
    assumedPacePct: 95,
  });
  assert.equal(multi.status, 'impossible-single');
  assert.equal(multi.examsNeededAtAssumedPace, 5);
});

test('exportExamsToCSV and sanitizeImportedExams work cleanly', () => {
  const imported = A.sanitizeImportedExams([
    {
      name: 'Final Exam',
      date: '2026-11-01',
      subjects: [{ name: 'Chemistry, Organic', scoredMarks: 44, totalMarks: 50 }],
    },
  ]);
  assert.equal(imported.length, 1);
  const csv = A.exportExamsToCSV(imported);
  assert.ok(csv.includes('"Chemistry, Organic"'));
  assert.ok(csv.includes('88.00%'));
});


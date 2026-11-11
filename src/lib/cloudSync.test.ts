import { describe, expect, it } from 'vitest';
import {
  getCloudPath,
  mergeStores,
  normalizeStore,
  sanitizeVaultKey,
} from './cloudSync';
import { DEFAULT_SETTINGS } from './defaults';

describe('cloudSync helpers', () => {
  it('sanitizes vault keys safely for Firebase RTDB paths', () => {
    expect(sanitizeVaultKey('  rithish.marks/2026$  ')).toBe('RITHISH-MARKS-2026');
    expect(sanitizeVaultKey('alpha_123')).toBe('ALPHA_123');
  });

  it('normalizes Firebase RTDB object-indexed arrays cleanly', () => {
    const rawFromRtdb = {
      updatedAt: 1700000000,
      exams: {
        0: {
          id: 'ex1',
          name: 'Unit Test 1',
          date: '2026-10-01',
          category: 'Unit Test',
          defaultTotalMarks: 50,
          subjects: {
            0: { id: 's1', name: 'Math', scoredMarks: 42, totalMarks: 50 },
          },
        },
      },
    };

    const store = normalizeStore(rawFromRtdb);
    expect(store.exams).toHaveLength(1);
    expect(store.exams[0].subjects).toHaveLength(1);
    expect(store.exams[0].subjects[0].scoredMarks).toBe(42);
    expect(store.settings.targetPercentage).toBe(DEFAULT_SETTINGS.targetPercentage);
  });

  it('resolves cloud paths for vault and account modes', () => {
    expect(
      getCloudPath({ mode: 'vault', vaultKey: 'pulse-123', userId: 'u1' })
    ).toBe('markAnalyser/vaults/PULSE-123');
    expect(
      getCloudPath({ mode: 'account', vaultKey: 'pulse-123', userId: 'u1' })
    ).toBe('markAnalyser/users/u1');
  });

  it('merges local and remote exams keeping newest updatedAt per exam', () => {
    const local = normalizeStore({
      updatedAt: 200,
      exams: [
        {
          id: 'ex1',
          name: 'Local Updated',
          date: '2026-10-01',
          updatedAt: 200,
          subjects: [{ id: 's1', name: 'Math', scoredMarks: 90, totalMarks: 100 }],
        },
        {
          id: 'ex2',
          name: 'Local Only',
          date: '2026-10-05',
          updatedAt: 150,
          subjects: [{ id: 's2', name: 'Physics', scoredMarks: 80, totalMarks: 100 }],
        },
      ],
    });
    const remote = normalizeStore({
      updatedAt: 180,
      exams: [
        {
          id: 'ex1',
          name: 'Remote Older',
          date: '2026-10-01',
          updatedAt: 100,
          subjects: [{ id: 's1', name: 'Math', scoredMarks: 70, totalMarks: 100 }],
        },
        {
          id: 'ex3',
          name: 'Remote Only',
          date: '2026-10-09',
          updatedAt: 180,
          subjects: [{ id: 's3', name: 'Chem', scoredMarks: 88, totalMarks: 100 }],
        },
      ],
    });

    const merged = mergeStores(local, remote);
    expect(merged.exams).toHaveLength(3);
    expect(merged.exams.find((e) => e.id === 'ex1')?.name).toBe('Local Updated');
  });
});


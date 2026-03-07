'use strict';

const {
  normalizeTranscript,
  lookupTranscriptEntry,
  creditsEarned,
  creditsInProgress,
  creditsAttempted,
} = require('../../src/audit/transcript');
const { isPassingGrade, DEFAULT_GRADE_CONFIG } = require('../../src/grade');

const complete = require('../fixtures/transcripts/minimal/complete.json');
const empty = require('../fixtures/transcripts/minimal/empty.json');
const partial = require('../fixtures/transcripts/minimal/partial.json');
const inProgress = require('../fixtures/transcripts/minimal/in-progress.json');
const failing = require('../fixtures/transcripts/minimal/failing-grades.json');

const gradeConfig = DEFAULT_GRADE_CONFIG;

// ============================================================
// normalizeTranscript
// ============================================================

describe('normalizeTranscript', () => {
  test('builds byKey Map with all entries from complete transcript', () => {
    const norm = normalizeTranscript(complete, gradeConfig);
    expect(norm.byKey.size).toBe(22);
    expect(norm.byKey.get('MATH:151').grade).toBe('A-');
  });

  test('empty transcript produces empty result', () => {
    const norm = normalizeTranscript(empty, gradeConfig);
    expect(norm.byKey.size).toBe(0);
    expect(norm.courses).toHaveLength(0);
  });

  test('null transcript produces empty result', () => {
    const norm = normalizeTranscript(null, gradeConfig);
    expect(norm.byKey.size).toBe(0);
  });

  test('undefined transcript produces empty result', () => {
    const norm = normalizeTranscript(undefined, gradeConfig);
    expect(norm.byKey.size).toBe(0);
  });

  test('filters out withdrawn entries', () => {
    const norm = normalizeTranscript(failing, gradeConfig);
    // ENGL 101 has status: withdrawn — should be excluded
    expect(norm.byKey.has('ENGL:101')).toBe(false);
    // CMPS 135 has grade NP but status completed — should be included
    expect(norm.byKey.has('CMPS:135')).toBe(true);
  });

  test('filters out audit:false grades', () => {
    const configWithRetake = {
      scale: [
        { grade: 'A', points: 4.0 },
        { grade: 'B', points: 3.0 },
        { grade: 'RD', points: 1.0, audit: false },
        { grade: 'F', points: 0.0 },
      ],
      passFail: [],
      withdrawal: ['W'],
      incomplete: [],
    };
    const entries = [
      { subject: 'MATH', number: '101', grade: 'RD', credits: 3, term: 'Fall 2023', status: 'completed' },
      { subject: 'MATH', number: '101', grade: 'B', credits: 3, term: 'Spring 2024', status: 'completed' },
      { subject: 'CMPS', number: '130', grade: 'A', credits: 3, term: 'Fall 2023', status: 'completed' },
    ];
    const norm = normalizeTranscript(entries, configWithRetake);
    // RD filtered out, then B overwrites (last entry wins)
    expect(norm.byKey.get('MATH:101').grade).toBe('B');
    expect(norm.byKey.get('CMPS:130').grade).toBe('A');
    expect(norm.byKey.size).toBe(2);
  });

  test('deduplicates by courseKey — last entry wins', () => {
    const entries = [
      { subject: 'MATH', number: '101', grade: 'D', credits: 3, term: 'Fall 2023', status: 'completed' },
      { subject: 'MATH', number: '101', grade: 'B', credits: 3, term: 'Spring 2024', status: 'completed' },
    ];
    const norm = normalizeTranscript(entries, gradeConfig);
    expect(norm.byKey.size).toBe(1);
    expect(norm.byKey.get('MATH:101').grade).toBe('B');
    expect(norm.byKey.get('MATH:101').term).toBe('Spring 2024');
  });

  test('courses array matches byKey values', () => {
    const norm = normalizeTranscript(partial, gradeConfig);
    expect(norm.courses).toHaveLength(norm.byKey.size);
    for (const entry of norm.courses) {
      expect(norm.byKey.has(`${entry.subject}:${entry.number}`)).toBe(true);
    }
  });

  test('in-progress entries with null grade are included', () => {
    const norm = normalizeTranscript(inProgress, gradeConfig);
    const math152 = norm.byKey.get('MATH:152');
    expect(math152).toBeDefined();
    expect(math152.grade).toBeNull();
    expect(math152.status).toBe('in-progress');
  });

  test('builds crossListGroup index when catalogIndex provided', () => {
    const catalogIndex = new Map();
    catalogIndex.set('MATH:311', { subject: 'MATH', number: '311', crossListGroup: 'xlg-1' });
    catalogIndex.set('CMPS:311', { subject: 'CMPS', number: '311', crossListGroup: 'xlg-1' });

    const entries = [
      { subject: 'MATH', number: '311', grade: 'A', credits: 3, term: 'Fall 2024', status: 'completed' },
    ];
    const norm = normalizeTranscript(entries, gradeConfig, catalogIndex);
    expect(norm.byCrossListGroup.has('xlg-1')).toBe(true);
    expect(norm.byCrossListGroup.get('xlg-1')).toHaveLength(1);
    expect(norm.byCrossListGroup.get('xlg-1')[0].subject).toBe('MATH');
  });

  test('crossListGroup index empty when no catalogIndex', () => {
    const norm = normalizeTranscript(complete, gradeConfig);
    expect(norm.byCrossListGroup.size).toBe(0);
  });

  // -- duplicatePolicy --

  test('duplicatePolicy "latest" keeps last entry (default behavior)', () => {
    const entries = [
      { subject: 'MATH', number: '101', grade: 'D', credits: 3, term: 'Fall 2023', status: 'completed' },
      { subject: 'MATH', number: '101', grade: 'B', credits: 3, term: 'Spring 2024', status: 'completed' },
    ];
    const norm = normalizeTranscript(entries, gradeConfig, null, { duplicatePolicy: 'latest' });
    expect(norm.byKey.size).toBe(1);
    expect(norm.byKey.get('MATH:101').grade).toBe('B');
    expect(norm.byKey.get('MATH:101').term).toBe('Spring 2024');
  });

  test('duplicatePolicy "first" keeps first entry', () => {
    const entries = [
      { subject: 'MATH', number: '101', grade: 'A', credits: 3, term: 'Fall 2023', status: 'completed' },
      { subject: 'MATH', number: '101', grade: 'B', credits: 3, term: 'Spring 2024', status: 'completed' },
    ];
    const norm = normalizeTranscript(entries, gradeConfig, null, { duplicatePolicy: 'first' });
    expect(norm.byKey.size).toBe(1);
    expect(norm.byKey.get('MATH:101').grade).toBe('A');
    expect(norm.byKey.get('MATH:101').term).toBe('Fall 2023');
  });

  test('duplicatePolicy "best-grade" keeps entry with highest grade points', () => {
    const entries = [
      { subject: 'MATH', number: '101', grade: 'D', credits: 3, term: 'Fall 2023', status: 'completed' },
      { subject: 'MATH', number: '101', grade: 'A', credits: 3, term: 'Spring 2024', status: 'completed' },
      { subject: 'MATH', number: '101', grade: 'C', credits: 3, term: 'Fall 2024', status: 'completed' },
    ];
    const norm = normalizeTranscript(entries, gradeConfig, null, { duplicatePolicy: 'best-grade' });
    expect(norm.byKey.size).toBe(1);
    expect(norm.byKey.get('MATH:101').grade).toBe('A');
    expect(norm.byKey.get('MATH:101').term).toBe('Spring 2024');
  });

  test('duplicatePolicy "best-grade" keeps higher grade when first attempt is better', () => {
    const entries = [
      { subject: 'CMPS', number: '230', grade: 'B+', credits: 3, term: 'Fall 2023', status: 'completed' },
      { subject: 'CMPS', number: '230', grade: 'C-', credits: 3, term: 'Spring 2024', status: 'completed' },
    ];
    const norm = normalizeTranscript(entries, gradeConfig, null, { duplicatePolicy: 'best-grade' });
    expect(norm.byKey.get('CMPS:230').grade).toBe('B+');
  });

  test('duplicatePolicy "best-grade" handles single entry correctly', () => {
    const entries = [
      { subject: 'MATH', number: '101', grade: 'C', credits: 3, term: 'Fall 2023', status: 'completed' },
    ];
    const norm = normalizeTranscript(entries, gradeConfig, null, { duplicatePolicy: 'best-grade' });
    expect(norm.byKey.size).toBe(1);
    expect(norm.byKey.get('MATH:101').grade).toBe('C');
  });

  test('duplicatePolicy defaults to "latest" when not specified', () => {
    const entries = [
      { subject: 'MATH', number: '101', grade: 'A', credits: 3, term: 'Fall 2023', status: 'completed' },
      { subject: 'MATH', number: '101', grade: 'C', credits: 3, term: 'Spring 2024', status: 'completed' },
    ];
    const norm = normalizeTranscript(entries, gradeConfig);
    expect(norm.byKey.get('MATH:101').grade).toBe('C'); // last wins
  });

  test('duplicatePolicy with multiple courses only deduplicates same courseKey', () => {
    const entries = [
      { subject: 'MATH', number: '101', grade: 'D', credits: 3, term: 'Fall 2023', status: 'completed' },
      { subject: 'CMPS', number: '130', grade: 'B', credits: 3, term: 'Fall 2023', status: 'completed' },
      { subject: 'MATH', number: '101', grade: 'A', credits: 3, term: 'Spring 2024', status: 'completed' },
    ];
    const norm = normalizeTranscript(entries, gradeConfig, null, { duplicatePolicy: 'best-grade' });
    expect(norm.byKey.size).toBe(2);
    expect(norm.byKey.get('MATH:101').grade).toBe('A');
    expect(norm.byKey.get('CMPS:130').grade).toBe('B');
  });
});

// ============================================================
// lookupTranscriptEntry
// ============================================================

describe('lookupTranscriptEntry', () => {
  const norm = normalizeTranscript(complete, gradeConfig);

  test('direct match returns entry with crossListed: false', () => {
    const result = lookupTranscriptEntry('MATH:151', norm);
    expect(result.entry).not.toBeNull();
    expect(result.entry.grade).toBe('A-');
    expect(result.crossListed).toBe(false);
  });

  test('no match returns entry: null', () => {
    const result = lookupTranscriptEntry('PHYS:999', norm);
    expect(result.entry).toBeNull();
    expect(result.crossListed).toBe(false);
  });

  test('cross-list fallback finds entry via crossListGroup', () => {
    // Student took MATH:311, requirement asks for CMPS:311 (cross-listed)
    const catalogIndex = new Map();
    catalogIndex.set('MATH:311', { subject: 'MATH', number: '311', crossListGroup: 'xlg-1' });
    catalogIndex.set('CMPS:311', { subject: 'CMPS', number: '311', crossListGroup: 'xlg-1' });

    const crossListIndex = new Map();
    crossListIndex.set('xlg-1', [
      { subject: 'MATH', number: '311', crossListGroup: 'xlg-1' },
      { subject: 'CMPS', number: '311', crossListGroup: 'xlg-1' },
    ]);

    const entries = [
      { subject: 'MATH', number: '311', grade: 'A', credits: 3, term: 'Fall 2024', status: 'completed' },
    ];
    const xlNorm = normalizeTranscript(entries, gradeConfig, catalogIndex);

    const result = lookupTranscriptEntry('CMPS:311', xlNorm, catalogIndex, crossListIndex);
    expect(result.entry).not.toBeNull();
    expect(result.entry.subject).toBe('MATH');
    expect(result.entry.number).toBe('311');
    expect(result.crossListed).toBe(true);
  });

  test('direct match takes priority over cross-list', () => {
    // Student took both the original and cross-listed version
    const catalogIndex = new Map();
    catalogIndex.set('CMPS:311', { subject: 'CMPS', number: '311', crossListGroup: 'xlg-1' });
    catalogIndex.set('MATH:311', { subject: 'MATH', number: '311', crossListGroup: 'xlg-1' });

    const crossListIndex = new Map();
    crossListIndex.set('xlg-1', [
      { subject: 'CMPS', number: '311', crossListGroup: 'xlg-1' },
      { subject: 'MATH', number: '311', crossListGroup: 'xlg-1' },
    ]);

    const entries = [
      { subject: 'CMPS', number: '311', grade: 'B', credits: 3, term: 'Fall 2024', status: 'completed' },
      { subject: 'MATH', number: '311', grade: 'A', credits: 3, term: 'Fall 2024', status: 'completed' },
    ];
    const xlNorm = normalizeTranscript(entries, gradeConfig, catalogIndex);

    const result = lookupTranscriptEntry('CMPS:311', xlNorm, catalogIndex, crossListIndex);
    expect(result.entry.subject).toBe('CMPS');
    expect(result.crossListed).toBe(false);
  });

  test('cross-list with no match returns null', () => {
    const catalogIndex = new Map();
    catalogIndex.set('CMPS:311', { subject: 'CMPS', number: '311', crossListGroup: 'xlg-1' });

    const crossListIndex = new Map();
    crossListIndex.set('xlg-1', [
      { subject: 'CMPS', number: '311', crossListGroup: 'xlg-1' },
      { subject: 'MATH', number: '311', crossListGroup: 'xlg-1' },
    ]);

    const emptyNorm = normalizeTranscript([], gradeConfig);
    const result = lookupTranscriptEntry('CMPS:311', emptyNorm, catalogIndex, crossListIndex);
    expect(result.entry).toBeNull();
  });
});

// ============================================================
// Credit helpers
// ============================================================

describe('creditsEarned', () => {
  test('sums credits for completed courses with passing grades', () => {
    const norm = normalizeTranscript(complete, gradeConfig);
    // All 22 entries are completed with passing grades
    const earned = creditsEarned(norm.courses, gradeConfig, isPassingGrade);
    const expected = complete.reduce((sum, e) => sum + e.credits, 0);
    expect(earned).toBe(expected);
  });

  test('excludes in-progress entries', () => {
    const norm = normalizeTranscript(inProgress, gradeConfig);
    const earned = creditsEarned(norm.courses, gradeConfig, isPassingGrade);
    // Only completed entries with passing grades
    const completedPassing = inProgress.filter(e =>
      e.status === 'completed' && e.grade != null && isPassingGrade(e.grade, gradeConfig)
    );
    const expected = completedPassing.reduce((sum, e) => sum + e.credits, 0);
    expect(earned).toBe(expected);
  });

  test('excludes failing grades', () => {
    const norm = normalizeTranscript(failing, gradeConfig);
    const earned = creditsEarned(norm.courses, gradeConfig, isPassingGrade);
    // Only MATH 101 (B+) and CMPS 130 (D-, passing with 0.7 points) are passing
    // MATH 151 (F), CMPS 135 (NP), CMPS 230 (F) are not passing
    // ENGL 101 (W) was filtered as withdrawn
    expect(earned).toBe(3 + 3); // MATH 101 + CMPS 130
  });

  test('empty transcript returns 0', () => {
    const norm = normalizeTranscript(empty, gradeConfig);
    expect(creditsEarned(norm.courses, gradeConfig, isPassingGrade)).toBe(0);
  });
});

describe('creditsInProgress', () => {
  test('sums credits for in-progress courses', () => {
    const norm = normalizeTranscript(inProgress, gradeConfig);
    const ip = creditsInProgress(norm.courses);
    // MATH 152 (4), CMPS 310 (3), CMPS 320 (3)
    expect(ip).toBe(10);
  });

  test('complete transcript has 0 in-progress credits', () => {
    const norm = normalizeTranscript(complete, gradeConfig);
    expect(creditsInProgress(norm.courses)).toBe(0);
  });

  test('empty transcript returns 0', () => {
    const norm = normalizeTranscript(empty, gradeConfig);
    expect(creditsInProgress(norm.courses)).toBe(0);
  });
});

describe('creditsAttempted', () => {
  test('sums all credits (completed + in-progress, not withdrawn)', () => {
    const norm = normalizeTranscript(inProgress, gradeConfig);
    const attempted = creditsAttempted(norm.courses);
    // All non-withdrawn entries
    const expected = inProgress
      .filter(e => e.status !== 'withdrawn')
      .reduce((sum, e) => sum + e.credits, 0);
    expect(attempted).toBe(expected);
  });

  test('complete transcript: attempted equals earned', () => {
    const norm = normalizeTranscript(complete, gradeConfig);
    const attempted = creditsAttempted(norm.courses);
    const earned = creditsEarned(norm.courses, gradeConfig, isPassingGrade);
    expect(attempted).toBe(earned);
  });

  test('failing transcript: attempted includes failed courses', () => {
    const norm = normalizeTranscript(failing, gradeConfig);
    const attempted = creditsAttempted(norm.courses);
    // MATH 101 (3), MATH 151 (4), CMPS 130 (3), CMPS 135 (3), CMPS 230 (3)
    // ENGL 101 filtered (withdrawn)
    expect(attempted).toBe(16);
  });

  test('empty transcript returns 0', () => {
    const norm = normalizeTranscript(empty, gradeConfig);
    expect(creditsAttempted(norm.courses)).toBe(0);
  });
});

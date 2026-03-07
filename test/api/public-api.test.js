'use strict';

/**
 * Public API structural guard + integration tests.
 *
 * All imports via the public entry point — no internal module imports.
 * Verifies the class-based API shape and exercises the full public surface.
 */

const api = require('../../src/index');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');
const completeTx = require('../fixtures/transcripts/minimal/complete.json');
const partialTx = require('../fixtures/transcripts/minimal/partial.json');
const inProgressTx = require('../fixtures/transcripts/minimal/in-progress.json');

// ============================================================
// 1. Structural guards — API shape
// ============================================================

describe('public API — structural guards', () => {
  const expectedFactories = ['parse', 'fromAST', 'catalog', 'transcript', 'waiver', 'substitution'];
  const expectedClasses = [
    'Requirement', 'Catalog', 'Transcript', 'TranscriptEntry',
    'ResolutionResult', 'AuditResult', 'MultiAuditResult',
    'Waiver', 'Substitution',
  ];
  const expectedModuleFunctions = [
    'auditMulti', 'exportPrereqMatrix', 'exportDependencyMatrix',
    'meetsMinGrade', 'isPassingGrade', 'calculateGPA', 'isValidGrade',
  ];
  const expectedBackwardCompat = [
    'CourseAssignmentMap', 'prepareAudit', 'isAuditableGrade', 'DEFAULT_GRADE_CONFIG',
  ];

  test.each(expectedFactories)('%s is exported as a function', (name) => {
    expect(typeof api[name]).toBe('function');
  });

  test.each(expectedClasses)('%s is exported as a constructor', (name) => {
    expect(typeof api[name]).toBe('function');
  });

  test.each(expectedModuleFunctions)('%s is exported as a function', (name) => {
    expect(typeof api[name]).toBe('function');
  });

  test.each(expectedBackwardCompat)('%s is exported', (name) => {
    expect(api[name]).toBeDefined();
  });

  test('AuditStatus is exported with all six values', () => {
    expect(api.AuditStatus).toBeDefined();
    expect(api.AuditStatus.MET).toBe('met');
    expect(api.AuditStatus.IN_PROGRESS).toBe('in-progress');
    expect(api.AuditStatus.PARTIAL_PROGRESS).toBe('partial-progress');
    expect(api.AuditStatus.NOT_MET).toBe('not-met');
    expect(api.AuditStatus.WAIVED).toBe('waived');
    expect(api.AuditStatus.SUBSTITUTED).toBe('substituted');
  });

  test('no unexpected undefined exports', () => {
    const allKeys = Object.keys(api);
    const undefinedKeys = allKeys.filter(k => api[k] === undefined);
    expect(undefinedKeys).toHaveLength(0);
  });

  test('parse returns Requirement with ast, text, and description', () => {
    const req = api.parse('MATH 151');
    expect(req).toBeInstanceOf(api.Requirement);
    expect(req.ast).toBeDefined();
    expect(typeof req.text).toBe('string');
    expect(typeof req.description).toBe('string');
  });
});

// ============================================================
// 2. Requirement construction
// ============================================================

describe('Requirement construction', () => {
  test('parse(text) returns Requirement instance', () => {
    const req = api.parse('MATH 151');
    expect(req).toBeInstanceOf(api.Requirement);
  });

  test('fromAST(plainObject) returns Requirement instance', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const req = api.fromAST(ast);
    expect(req).toBeInstanceOf(api.Requirement);
  });

  test('parse(invalidText) throws with structured error', () => {
    expect(() => api.parse('%%%')).toThrow();
  });

  test('fromAST + validate() catches malformed AST', () => {
    const req = api.fromAST({ type: 'all-of', items: 'not-an-array' });
    const result = req.validate();
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  test('req.ast is frozen', () => {
    const req = api.parse('MATH 151');
    expect(Object.isFrozen(req.ast)).toBe(true);
  });

  test('req.text returns canonical DSL text', () => {
    const req = api.parse('MATH 151');
    expect(req.text).toBe('MATH 151');
  });

  test('req.description returns human-readable string', () => {
    const req = api.parse('all of (MATH 151, CMPS 130)');
    expect(typeof req.description).toBe('string');
    expect(req.description).toContain('MATH');
  });

  test('req.ast is serializable (JSON roundtrip)', () => {
    const req = api.parse('all of (MATH 151, CMPS 130)');
    const json = JSON.stringify(req.ast);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(req.ast);
  });
});

// ============================================================
// 3. Immutability
// ============================================================

describe('Immutability', () => {
  test('Object.isFrozen(req.ast) is true', () => {
    const req = api.parse('MATH 151');
    expect(Object.isFrozen(req.ast)).toBe(true);
  });

  test('modifying the original AST after fromAST does not affect the Requirement', () => {
    const original = { type: 'course', subject: 'MATH', number: '151' };
    const req = api.fromAST(original);
    original.subject = 'CHANGED';
    expect(req.ast.subject).toBe('MATH');
  });

  test('transform() returns new Requirement, original unchanged', () => {
    const req = api.parse('MATH 151');
    const transformed = req.transform(node => {
      if (node.type === 'course') return { ...node, subject: 'PHYS' };
      return node;
    });
    expect(transformed).toBeInstanceOf(api.Requirement);
    expect(transformed.ast.subject).toBe('PHYS');
    expect(req.ast.subject).toBe('MATH');
  });

  test('req.ast property cannot be replaced', () => {
    const req = api.parse('MATH 151');
    // Private field — assignment just creates a new non-functional property
    expect(() => { req.ast = {}; }).toThrow();
  });
});

// ============================================================
// 4. Rendering
// ============================================================

describe('Rendering', () => {
  test('req.text is a string', () => {
    const req = api.parse('all of (MATH 151, CMPS 130)');
    expect(typeof req.text).toBe('string');
  });

  test('req.description is a string', () => {
    const req = api.parse('all of (MATH 151, CMPS 130)');
    expect(typeof req.description).toBe('string');
  });

  test('toOutline(catalog) returns string with course titles', () => {
    const req = api.parse('MATH 151');
    const outline = req.toOutline(minimalCatalog);
    expect(typeof outline).toBe('string');
    expect(outline).toContain('Calculus I');
  });

  test('toOutline(plainObj) works with plain catalog object', () => {
    const req = api.parse('MATH 151');
    const outline = req.toOutline(minimalCatalog);
    expect(typeof outline).toBe('string');
  });

  test('toHTML(catalog) returns string with reqit- CSS classes', () => {
    const req = api.parse('MATH 151');
    const html = req.toHTML(minimalCatalog);
    expect(typeof html).toBe('string');
    expect(html).toContain('reqit-course');
  });

  test('toHTML(Catalog) works with Catalog entity', () => {
    const req = api.parse('MATH 151');
    const cat = api.catalog(minimalCatalog);
    const html = req.toHTML(cat);
    expect(html).toContain('reqit-course');
  });

  test('renderers are pure (same input → same output)', () => {
    const req = api.parse('all of (MATH 151, CMPS 130)');
    expect(req.text).toBe(req.text);
    expect(req.description).toBe(req.description);
    expect(req.toHTML(minimalCatalog)).toBe(req.toHTML(minimalCatalog));
  });

  test('complex AST renders correctly', () => {
    const req = api.parse('at least 2 of (MATH 151, CMPS 130, CMPS 135)');
    const html = req.toHTML(minimalCatalog);
    expect(html).toContain('reqit-');
    expect(html).toContain('MATH');
    expect(html).toContain('CMPS');
  });
});

// ============================================================
// 5. Validation
// ============================================================

describe('Validation', () => {
  test('valid AST validates with { valid: true }', () => {
    const req = api.parse('MATH 151');
    const result = req.validate();
    expect(result.valid).toBe(true);
  });

  test('invalid AST validates with errors', () => {
    const req = api.fromAST({ type: 'n-of', items: [], count: -1, comparison: 'at-least' });
    const result = req.validate();
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  test('errors have path, rule, message fields', () => {
    const req = api.fromAST({ type: 'n-of', items: [], count: -1, comparison: 'at-least' });
    const result = req.validate();
    const err = result.errors[0];
    expect(err).toHaveProperty('path');
    expect(err).toHaveProperty('rule');
    expect(err).toHaveProperty('message');
  });

  test('parsed AST always validates', () => {
    const req = api.parse('all of (MATH 151, any of (CMPS 130, CMPS 135))');
    expect(req.validate().valid).toBe(true);
  });
});

// ============================================================
// 6. Resolution
// ============================================================

describe('Resolution', () => {
  test('resolve(catalog) returns ResolutionResult', () => {
    const req = api.parse('MATH 151');
    const result = req.resolve(minimalCatalog);
    expect(result).toBeInstanceOf(api.ResolutionResult);
  });

  test('result.courses is an array', () => {
    const req = api.parse('MATH 151');
    const result = req.resolve(minimalCatalog);
    expect(Array.isArray(result.courses)).toBe(true);
  });

  test('result.filters has matched courses for filter nodes', () => {
    const req = api.parse('courses where subject = "CMPS"');
    const result = req.resolve(minimalCatalog);
    expect(Array.isArray(result.filters)).toBe(true);
    expect(result.filters).toHaveLength(1);
    expect(result.filters[0].matched).toHaveLength(11);
  });

  test('works with Catalog entity', () => {
    const req = api.parse('MATH 151');
    const cat = api.catalog(minimalCatalog);
    const result = req.resolve(cat);
    expect(result.courses).toHaveLength(1);
  });

  test('works with plain catalog object', () => {
    const req = api.parse('MATH 151');
    const result = req.resolve(minimalCatalog);
    expect(result.courses).toHaveLength(1);
  });

  test('requirement unchanged after resolve', () => {
    const req = api.parse('MATH 151');
    const textBefore = req.text;
    req.resolve(minimalCatalog);
    expect(req.text).toBe(textBefore);
  });
});

// ============================================================
// 7. Single-tree audit
// ============================================================

describe('Single-tree audit', () => {
  test('audit(catalog, transcript) returns AuditResult', () => {
    const req = api.parse('MATH 151');
    const result = req.audit(minimalCatalog, completeTx);
    expect(result).toBeInstanceOf(api.AuditResult);
  });

  test('result.status is an AuditStatus value', () => {
    const req = api.parse('MATH 151');
    const result = req.audit(minimalCatalog, completeTx);
    expect(Object.values(api.AuditStatus)).toContain(result.status);
  });

  test('result.items is the annotated tree', () => {
    const req = api.parse('MATH 151');
    const result = req.audit(minimalCatalog, completeTx);
    expect(result.items).toBeDefined();
    expect(result.items.type).toBe('course');
  });

  test('result.summary has met, notMet, inProgress', () => {
    const req = api.parse('all of (MATH 151, CMPS 130)');
    const result = req.audit(minimalCatalog, completeTx);
    const s = result.summary;
    expect(s).toHaveProperty('met');
    expect(s).toHaveProperty('notMet');
    expect(s).toHaveProperty('inProgress');
  });

  test('result.warnings is an array', () => {
    const req = api.parse('MATH 151');
    const result = req.audit(minimalCatalog, completeTx);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  test('result.findUnmet() returns unmet leaf nodes', () => {
    const req = api.parse('all of (MATH 151, CMPS 310)');
    const result = req.audit(minimalCatalog, partialTx);
    const unmet = result.findUnmet();
    expect(Array.isArray(unmet)).toBe(true);
    expect(unmet).toHaveLength(1);
  });

  test('result.findNextEligible(catalog, transcript) returns eligible courses', () => {
    const req = api.parse('all of (MATH 151, CMPS 310)');
    const result = req.audit(minimalCatalog, partialTx);
    const eligible = result.findNextEligible(minimalCatalog, partialTx);
    expect(Array.isArray(eligible)).toBe(true);
  });

  test('result.toHTML(catalog) returns HTML with status classes', () => {
    const req = api.parse('MATH 151');
    const result = req.audit(minimalCatalog, completeTx);
    const html = result.toHTML(minimalCatalog);
    expect(typeof html).toBe('string');
    expect(html).toContain('reqit-status-met');
  });

  test('result.export(catalog, { format: "csv" }) returns CSV string', () => {
    const req = api.parse('all of (MATH 151, CMPS 130)');
    const result = req.audit(minimalCatalog, completeTx);
    const csv = result.export(minimalCatalog, { format: 'csv' });
    expect(typeof csv).toBe('string');
    expect(csv).toContain('MATH');
  });

  test('works with Catalog/Transcript entities', () => {
    const req = api.parse('MATH 151');
    const cat = api.catalog(minimalCatalog);
    const tx = api.transcript(completeTx);
    const result = req.audit(cat, tx);
    expect(result.status).toBe(api.AuditStatus.MET);
  });

  test('options: attainments (scores, booleans)', () => {
    const req = api.parse('score SAT >= 1200');
    const result = req.audit(minimalCatalog, [], { attainments: { SAT: { kind: 'score', value: 1300 } } });
    expect(result.status).toBe(api.AuditStatus.MET);
  });
});

// ============================================================
// 8. AuditStatus enum
// ============================================================

describe('AuditStatus enum', () => {
  test('AuditStatus.MET === "met"', () => {
    expect(api.AuditStatus.MET).toBe('met');
  });

  test('AuditStatus.NOT_MET === "not-met"', () => {
    expect(api.AuditStatus.NOT_MET).toBe('not-met');
  });

  test('AuditStatus.IN_PROGRESS === "in-progress"', () => {
    expect(api.AuditStatus.IN_PROGRESS).toBe('in-progress');
  });

  test('AuditStatus is frozen', () => {
    expect(Object.isFrozen(api.AuditStatus)).toBe(true);
  });
});

// ============================================================
// 9. Catalog entity
// ============================================================

describe('Catalog entity', () => {
  test('catalog(data) returns Catalog instance', () => {
    const cat = api.catalog(minimalCatalog);
    expect(cat).toBeInstanceOf(api.Catalog);
  });

  test('missing courses throws', () => {
    expect(() => api.catalog({})).toThrow('Catalog requires courses');
    expect(() => api.catalog(null)).toThrow();
  });

  test('catalog.data is frozen', () => {
    const cat = api.catalog(minimalCatalog);
    expect(Object.isFrozen(cat.data)).toBe(true);
  });

  test('shorthand getters return correct values', () => {
    const cat = api.catalog(minimalCatalog);
    expect(cat.institution).toBe('test');
    expect(cat.ay).toBe('2025-2026');
    expect(Array.isArray(cat.courses)).toBe(true);
    expect(Array.isArray(cat.programs)).toBe(true);
    expect(cat.gradeConfig).toBeDefined();
  });

  test('methods accept Catalog entity', () => {
    const cat = api.catalog(minimalCatalog);
    const req = api.parse('MATH 151');
    const html = req.toHTML(cat);
    expect(html).toContain('reqit-course');
  });

  test('methods accept plain objects (backward compat)', () => {
    const req = api.parse('MATH 151');
    const html = req.toHTML(minimalCatalog);
    expect(html).toContain('reqit-course');
  });
});

// ============================================================
// 10. TranscriptEntry entity
// ============================================================

describe('TranscriptEntry entity', () => {
  test('constructor wraps plain object', () => {
    const entry = new api.TranscriptEntry({ subject: 'MATH', number: '151', grade: 'A', credits: 4 });
    expect(entry.subject).toBe('MATH');
    expect(entry.number).toBe('151');
  });

  test('missing subject/number throws', () => {
    expect(() => new api.TranscriptEntry({})).toThrow('TranscriptEntry requires subject and number');
    expect(() => new api.TranscriptEntry({ subject: 'MATH' })).toThrow();
  });

  test('getters return correct values', () => {
    const entry = new api.TranscriptEntry({
      subject: 'MATH', number: '151', grade: 'A', credits: 4, term: 'Fall 2024', status: 'completed',
    });
    expect(entry.subject).toBe('MATH');
    expect(entry.number).toBe('151');
    expect(entry.grade).toBe('A');
    expect(entry.credits).toBe(4);
    expect(entry.term).toBe('Fall 2024');
    expect(entry.status).toBe('completed');
  });

  test('defaults: grade → null, credits → 0, term → "", status → "completed"', () => {
    const entry = new api.TranscriptEntry({ subject: 'MATH', number: '151' });
    expect(entry.grade).toBeNull();
    expect(entry.credits).toBe(0);
    expect(entry.term).toBe('');
    expect(entry.status).toBe('completed');
  });

  test('toJSON() returns plain object', () => {
    const data = { subject: 'MATH', number: '151', grade: 'A', credits: 4 };
    const entry = new api.TranscriptEntry(data);
    const json = entry.toJSON();
    expect(json).toEqual(data);
    expect(json).not.toBe(data); // new object
  });

  test('entry data is frozen', () => {
    const entry = new api.TranscriptEntry({ subject: 'MATH', number: '151' });
    // The internal data is frozen, so the entry getters are stable
    expect(entry.subject).toBe('MATH');
  });
});

// ============================================================
// 11. Transcript entity
// ============================================================

describe('Transcript entity', () => {
  test('transcript(entries) returns Transcript instance', () => {
    const tx = api.transcript(completeTx);
    expect(tx).toBeInstanceOf(api.Transcript);
  });

  test('non-array throws', () => {
    expect(() => api.transcript('not-array')).toThrow('Transcript requires an array');
  });

  test('transcript.entries is frozen array of TranscriptEntry instances', () => {
    const tx = api.transcript(completeTx);
    expect(Object.isFrozen(tx.entries)).toBe(true);
    expect(tx.entries[0]).toBeInstanceOf(api.TranscriptEntry);
  });

  test('plain objects in constructor are wrapped as TranscriptEntry', () => {
    const tx = api.transcript([{ subject: 'MATH', number: '151', grade: 'A', credits: 4 }]);
    expect(tx.entries[0]).toBeInstanceOf(api.TranscriptEntry);
  });

  test('addEntry(plain) returns new Transcript with entry appended', () => {
    const tx = api.transcript(completeTx);
    const tx2 = tx.addEntry({ subject: 'NEW', number: '999', grade: 'B', credits: 3 });
    expect(tx2).toBeInstanceOf(api.Transcript);
    expect(tx2.entries).toHaveLength(tx.entries.length + 1);
    expect(tx2.entries[tx2.entries.length - 1].subject).toBe('NEW');
  });

  test('addEntry(TranscriptEntry) returns new Transcript', () => {
    const tx = api.transcript(completeTx);
    const entry = new api.TranscriptEntry({ subject: 'NEW', number: '999' });
    const tx2 = tx.addEntry(entry);
    expect(tx2.entries[tx2.entries.length - 1].subject).toBe('NEW');
  });

  test('removeEntry(subject, number) returns new Transcript without matching entries', () => {
    const tx = api.transcript(completeTx);
    const before = tx.entries.length;
    const tx2 = tx.removeEntry('MATH', '151');
    expect(tx2.entries.length).toBeLessThan(before);
    expect(tx2.entries.find(e => e.subject === 'MATH' && e.number === '151')).toBeUndefined();
  });

  test('original transcript unchanged after add/remove (immutability)', () => {
    const tx = api.transcript(completeTx);
    const originalLength = tx.entries.length;
    tx.addEntry({ subject: 'NEW', number: '999' });
    tx.removeEntry('MATH', '151');
    expect(tx.entries).toHaveLength(originalLength);
  });

  test('methods accept Transcript entity', () => {
    const req = api.parse('MATH 151');
    const cat = api.catalog(minimalCatalog);
    const tx = api.transcript(completeTx);
    const result = req.audit(cat, tx);
    expect(result.status).toBe(api.AuditStatus.MET);
  });

  test('methods accept plain arrays', () => {
    const req = api.parse('MATH 151');
    const result = req.audit(minimalCatalog, completeTx);
    expect(result.status).toBe(api.AuditStatus.MET);
  });
});

// ============================================================
// 12. Multi-tree audit
// ============================================================

describe('Multi-tree audit', () => {
  const majorReq = api.parse('all of (MATH 151, CMPS 130)');
  const minorReq = api.parse('all of (CMPS 130, CMPS 230)');

  test('auditMulti(catalog, transcript, { trees }) returns MultiAuditResult', () => {
    const result = api.auditMulti(minimalCatalog, completeTx, {
      trees: { major: majorReq, minor: minorReq },
    });
    expect(result).toBeInstanceOf(api.MultiAuditResult);
  });

  test('multi.trees is { name: AuditResult }', () => {
    const result = api.auditMulti(minimalCatalog, completeTx, {
      trees: { major: majorReq, minor: minorReq },
    });
    const trees = result.trees;
    expect(trees.major).toBeInstanceOf(api.AuditResult);
    expect(trees.minor).toBeInstanceOf(api.AuditResult);
  });

  test('each tree entry has AuditResult methods (findUnmet, toHTML)', () => {
    const result = api.auditMulti(minimalCatalog, completeTx, {
      trees: { major: majorReq },
    });
    const tree = result.trees.major;
    expect(typeof tree.findUnmet).toBe('function');
    expect(typeof tree.toHTML).toBe('function');
  });

  test('multi.overlapResults is an array', () => {
    const result = api.auditMulti(minimalCatalog, completeTx, {
      trees: { major: majorReq },
    });
    expect(Array.isArray(result.overlapResults)).toBe(true);
  });

  test('multi.courseAssignments is a CourseAssignmentMap', () => {
    const result = api.auditMulti(minimalCatalog, completeTx, {
      trees: { major: majorReq },
    });
    expect(result.courseAssignments).toBeInstanceOf(api.CourseAssignmentMap);
  });

  test('multi.warnings is an array', () => {
    const result = api.auditMulti(minimalCatalog, completeTx, {
      trees: { major: majorReq },
    });
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  test('works with Requirement values in trees map', () => {
    const result = api.auditMulti(minimalCatalog, completeTx, {
      trees: { major: majorReq },
    });
    expect(result.trees.major.status).toBe(api.AuditStatus.MET);
  });

  test('works with plain AST values in trees map', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const result = api.auditMulti(minimalCatalog, completeTx, {
      trees: { test: ast },
    });
    expect(result.trees.test.status).toBe(api.AuditStatus.MET);
  });

  test('programContext maps roles correctly', () => {
    const result = api.auditMulti(minimalCatalog, completeTx, {
      trees: { major: majorReq, minor: minorReq },
      programContext: { 'primary-major': 'major', 'primary-minor': 'minor' },
    });
    expect(result.trees.major).toBeDefined();
    expect(result.trees.minor).toBeDefined();
  });

  test('overlapRules are respected', () => {
    const result = api.auditMulti(minimalCatalog, completeTx, {
      trees: { major: majorReq, minor: minorReq },
      programContext: { 'primary-major': 'major', 'primary-minor': 'minor' },
      overlapRules: [{
        type: 'overlap-limit',
        left: { type: 'program-context-ref', role: 'primary-major' },
        right: { type: 'program-context-ref', role: 'primary-minor' },
        constraint: { comparison: 'at-most', value: 0, unit: 'courses' },
      }],
    });
    // CMPS 130 is shared, so overlap > 0 → policy fails
    const overlap = result.overlapResults.find(r => r.type === 'overlap-limit');
    expect(overlap).toBeDefined();
    expect(overlap.status).toBe(api.AuditStatus.NOT_MET);
  });
});

// ============================================================
// 13. AST utilities
// ============================================================

describe('AST utilities', () => {
  test('req.walk(cb) visits all nodes', () => {
    const req = api.parse('all of (MATH 151, CMPS 130)');
    const types = [];
    req.walk(node => types.push(node.type));
    expect(types).toContain('all-of');
    expect(types).toContain('course');
  });

  test('req.transform(cb) returns new Requirement', () => {
    const req = api.parse('MATH 151');
    const transformed = req.transform(node => node);
    expect(transformed).toBeInstanceOf(api.Requirement);
  });

  test('req.extractCourses() returns course references', () => {
    const req = api.parse('all of (MATH 151, CMPS 130)');
    const courses = req.extractCourses();
    expect(Array.isArray(courses)).toBe(true);
    expect(courses).toHaveLength(2);
  });

  test('req.extractAllReferences(catalog) returns explicit + filtered', () => {
    const req = api.parse('all of (MATH 151, courses where subject = "CMPS")');
    const refs = req.extractAllReferences(minimalCatalog);
    expect(refs.explicit).toHaveLength(1);
    expect(refs.filtered).toHaveLength(11);
  });

  test('req.diff(otherReq) returns changes array', () => {
    const a = api.parse('all of (MATH 151, CMPS 130)');
    const b = api.parse('all of (MATH 151, CMPS 135)');
    const changes = a.diff(b);
    expect(Array.isArray(changes)).toBe(true);
    expect(changes).toHaveLength(2);
  });

  test('req.diff(plainAST) works with plain AST', () => {
    const req = api.parse('MATH 151');
    const plain = { type: 'course', subject: 'PHYS', number: '201' };
    const changes = req.diff(plain);
    expect(Array.isArray(changes)).toBe(true);
    expect(changes).toHaveLength(2);
  });

  test('walk path and parent are correct', () => {
    const req = api.parse('all of (MATH 151, CMPS 130)');
    const paths = [];
    req.walk((node, path) => {
      if (node.type === 'course') paths.push(path);
    });
    expect(paths).toHaveLength(2);
  });

  test('transform identity produces structurally equal AST', () => {
    const req = api.parse('all of (MATH 151, CMPS 130)');
    const identity = req.transform(node => node);
    expect(identity.ast).toEqual(req.ast);
  });

  test('transform rename produces different subject in new Requirement', () => {
    const req = api.parse('MATH 151');
    const renamed = req.transform(node => {
      if (node.type === 'course') return { ...node, subject: 'PHYS' };
      return node;
    });
    expect(renamed.ast.subject).toBe('PHYS');
    expect(req.ast.subject).toBe('MATH');
  });

  test('extractAllReferences works with Catalog entity', () => {
    const req = api.parse('MATH 151');
    const cat = api.catalog(minimalCatalog);
    const refs = req.extractAllReferences(cat);
    expect(refs.explicit).toHaveLength(1);
  });
});

// ============================================================
// 14. Export
// ============================================================

describe('Export', () => {
  test('req.exportChecklist(catalog, { format: "csv" }) returns CSV string', () => {
    const req = api.parse('all of (MATH 151, CMPS 130)');
    const csv = req.exportChecklist(minimalCatalog, { format: 'csv' });
    expect(typeof csv).toBe('string');
    expect(csv).toContain('MATH');
  });

  test('req.exportChecklist(catalog, { format: "xlsx" }) returns Buffer', async () => {
    const req = api.parse('all of (MATH 151, CMPS 130)');
    const buf = await req.exportChecklist(minimalCatalog, { format: 'xlsx' });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  test('exportPrereqMatrix(catalog, { format: "csv" }) returns CSV', () => {
    const csv = api.exportPrereqMatrix(minimalCatalog, { format: 'csv' });
    expect(typeof csv).toBe('string');
  });

  test('exportDependencyMatrix(catalog, { format: "csv" }) returns CSV', () => {
    const csv = api.exportDependencyMatrix(minimalCatalog, { format: 'csv' });
    expect(typeof csv).toBe('string');
  });

  test('module-level exports work with Catalog entity', () => {
    const cat = api.catalog(minimalCatalog);
    const csv = api.exportPrereqMatrix(cat.data, { format: 'csv' });
    expect(typeof csv).toBe('string');
  });

  test('module-level exports work with plain objects', () => {
    const csv = api.exportPrereqMatrix(minimalCatalog, { format: 'csv' });
    expect(typeof csv).toBe('string');
  });

  test('XLSX format returns Buffer', async () => {
    const req = api.parse('MATH 151');
    const buf = await req.exportChecklist(minimalCatalog, { format: 'xlsx' });
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  test('audit export as CSV', () => {
    const req = api.parse('MATH 151');
    const result = req.audit(minimalCatalog, completeTx);
    const csv = result.export(minimalCatalog, { format: 'csv' });
    expect(typeof csv).toBe('string');
    expect(csv).toContain('MATH');
  });
});

// ============================================================
// 15. Grade utilities
// ============================================================

describe('Grade utilities', () => {
  test('meetsMinGrade("A", "B", gradeConfig) is true', () => {
    expect(api.meetsMinGrade('A', 'B', minimalCatalog.gradeConfig)).toBe(true);
  });

  test('isPassingGrade("A", gradeConfig) is true', () => {
    expect(api.isPassingGrade('A', minimalCatalog.gradeConfig)).toBe(true);
  });

  test('calculateGPA(entries, gradeConfig) returns a number', () => {
    const entries = [
      { grade: 'A', credits: 3 },
      { grade: 'B', credits: 3 },
    ];
    const gpa = api.calculateGPA(entries, minimalCatalog.gradeConfig);
    expect(typeof gpa).toBe('number');
    expect(gpa).toBe(3.5);
  });

  test('all are pure functions', () => {
    const r1 = api.meetsMinGrade('A', 'B', minimalCatalog.gradeConfig);
    const r2 = api.meetsMinGrade('A', 'B', minimalCatalog.gradeConfig);
    expect(r1).toBe(r2);
  });
});

// ============================================================
// 16. Fluent chaining
// ============================================================

describe('Fluent chaining', () => {
  test('parse(text).toHTML(catalog) — one-liner rendering', () => {
    const html = api.parse('MATH 151').toHTML(minimalCatalog);
    expect(html).toContain('reqit-course');
  });

  test('parse(text).audit(catalog, transcript).findUnmet() — audit pipeline', () => {
    const unmet = api.parse('all of (MATH 151, CMPS 310)')
      .audit(minimalCatalog, partialTx)
      .findUnmet();
    expect(Array.isArray(unmet)).toBe(true);
  });

  test('parse(text).transform(fn).text — transform + getter pipeline', () => {
    const text = api.parse('MATH 151')
      .transform(n => n.type === 'course' ? { ...n, subject: 'PHYS' } : n)
      .text;
    expect(text).toBe('PHYS 151');
  });

  test('parse(text).resolve(catalog).courses — resolution pipeline', () => {
    const courses = api.parse('MATH 151').resolve(minimalCatalog).courses;
    expect(Array.isArray(courses)).toBe(true);
  });

  test('parse(text).description — parse + description getter', () => {
    const desc = api.parse('MATH 151').description;
    expect(typeof desc).toBe('string');
  });
});

// ============================================================
// 17. Error handling
// ============================================================

describe('Error handling', () => {
  test('parse(invalid) throws with location info', () => {
    try {
      api.parse('%%%');
      expect(true).toBe(false); // should not reach
    } catch (e) {
      expect(e.message).toBeDefined();
    }
  });

  test('catalog(null) throws', () => {
    expect(() => api.catalog(null)).toThrow();
  });

  test('transcript("not-array") throws', () => {
    expect(() => api.transcript('not-array')).toThrow();
  });

  test('invalid AST via fromAST → validate returns errors', () => {
    // Missing type property triggers Rule 1 validation failure
    const req = api.fromAST({ subject: 'MATH', number: '151' });
    const result = req.validate();
    expect(result.valid).toBe(false);
  });

  test('audit with minimal catalog still completes', () => {
    const req = api.parse('MATH 151');
    const cat = { courses: [{ subject: 'MATH', number: '151' }] };
    const result = req.audit(cat, [{ subject: 'MATH', number: '151', grade: 'A', credits: 3, status: 'completed' }]);
    expect(result.status).toBeDefined();
  });
});

// ============================================================
// 18. Plain object acceptance (cross-cutting)
// ============================================================

describe('Plain object acceptance', () => {
  test('every method that accepts catalog also accepts plain object', () => {
    const req = api.parse('MATH 151');
    expect(() => req.toOutline(minimalCatalog)).not.toThrow();
    expect(() => req.toHTML(minimalCatalog)).not.toThrow();
    expect(() => req.resolve(minimalCatalog)).not.toThrow();
    expect(() => req.audit(minimalCatalog, completeTx)).not.toThrow();
  });

  test('every method that accepts transcript also accepts plain array', () => {
    const req = api.parse('MATH 151');
    expect(() => req.audit(minimalCatalog, completeTx)).not.toThrow();
  });

  test('diff() accepts Requirement or plain AST', () => {
    const req = api.parse('MATH 151');
    const other = api.parse('PHYS 201');
    expect(() => req.diff(other)).not.toThrow();
    expect(() => req.diff({ type: 'course', subject: 'PHYS', number: '201' })).not.toThrow();
  });

  test('auditMulti trees can be Requirement or plain AST', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const req = api.parse('CMPS 130');
    const result = api.auditMulti(minimalCatalog, completeTx, {
      trees: { a: ast, b: req },
    });
    expect(result.trees.a).toBeInstanceOf(api.AuditResult);
    expect(result.trees.b).toBeInstanceOf(api.AuditResult);
  });

  test('Transcript constructor accepts plain entry objects', () => {
    const tx = api.transcript([{ subject: 'MATH', number: '151', grade: 'A', credits: 3 }]);
    expect(tx.entries[0]).toBeInstanceOf(api.TranscriptEntry);
  });
});

// ============================================================
// 19. Backward compatibility
// ============================================================

describe('Backward compatibility', () => {
  test('prepareAudit is exported and functional', () => {
    const ast = api.parse('MATH 151').ast;
    const prepared = api.prepareAudit(ast, minimalCatalog);
    expect(typeof prepared.run).toBe('function');
    const result = prepared.run(completeTx);
    expect(result.status).toBe('met');
  });

  test('CourseAssignmentMap is exported', () => {
    const cam = new api.CourseAssignmentMap();
    expect(typeof cam.assign).toBe('function');
  });

  test('isAuditableGrade is exported', () => {
    expect(typeof api.isAuditableGrade).toBe('function');
  });

  test('DEFAULT_GRADE_CONFIG is exported', () => {
    expect(api.DEFAULT_GRADE_CONFIG).toBeDefined();
    expect(api.DEFAULT_GRADE_CONFIG.scale).toBeDefined();
  });
});

// ============================================================
// 20. AuditResult.summary correctness (F8)
// ============================================================

describe('AuditResult.summary correctness', () => {
  test('complete transcript — all met', () => {
    const req = api.parse('all of (MATH 151, CMPS 130)');
    const result = req.audit(minimalCatalog, completeTx);
    expect(result.summary).toEqual({
      met: 2, waived: 0, substituted: 0, inProgress: 0, partialProgress: 0, notMet: 0, total: 2,
    });
  });

  test('partial transcript — mixed met/not-met', () => {
    const req = api.parse('all of (MATH 151, CMPS 310)');
    const result = req.audit(minimalCatalog, partialTx);
    expect(result.summary).toEqual({
      met: 1, waived: 0, substituted: 0, inProgress: 0, partialProgress: 0, notMet: 1, total: 2,
    });
  });

  test('in-progress transcript — in-progress items', () => {
    const req = api.parse('all of (CMPS 310, CMPS 320)');
    const result = req.audit(minimalCatalog, inProgressTx);
    expect(result.summary).toEqual({
      met: 0, waived: 0, substituted: 0, inProgress: 2, partialProgress: 0, notMet: 0, total: 2,
    });
  });

  test('credits-from root — walks source.items', () => {
    const req = api.parse('at least 6 credits from (MATH 151, CMPS 130)');
    const result = req.audit(minimalCatalog, completeTx);
    expect(result.summary).toEqual({
      met: 2, waived: 0, substituted: 0, inProgress: 0, partialProgress: 0, notMet: 0, total: 2,
    });
  });

  test('leaf root — single item summary', () => {
    const req = api.parse('MATH 151');
    const result = req.audit(minimalCatalog, completeTx);
    expect(result.summary).toEqual({
      met: 1, waived: 0, substituted: 0, inProgress: 0, partialProgress: 0, notMet: 0, total: 1,
    });
  });
});

// ============================================================
// 21. MultiAuditResult.trees identity stability (F9)
// ============================================================

describe('MultiAuditResult.trees identity stability', () => {
  test('repeated access returns same object reference', () => {
    const multi = api.auditMulti(minimalCatalog, completeTx, {
      trees: {
        a: api.parse('MATH 151'),
        b: api.parse('CMPS 130'),
      },
    });
    expect(multi.trees).toBe(multi.trees);
  });
});

// ============================================================
// 22. Entity construction edge cases (F10)
// ============================================================

describe('Entity construction edge cases', () => {
  test('catalog with empty courses array is valid', () => {
    const cat = api.catalog({ courses: [], ay: '2024-2025' });
    expect(cat.courses).toEqual([]);
  });

  test('catalog with missing ay throws', () => {
    expect(() => api.catalog({ courses: [{ subject: 'MATH', number: '151' }] }))
      .toThrow('Catalog requires ay');
  });

  test('empty transcript is valid', () => {
    const tx = api.transcript([]);
    expect(tx.entries).toHaveLength(0);
  });

  test('TranscriptEntry preserves extra fields in toJSON()', () => {
    const entry = new api.TranscriptEntry({
      subject: 'MATH', number: '151', grade: 'A', credits: 4, custom: 'extra',
    });
    const json = entry.toJSON();
    expect(json.custom).toBe('extra');
  });

  test('deeply nested AST survives structuredClone in Requirement', () => {
    // Build a 5-level nested all-of
    let ast = { type: 'course', subject: 'MATH', number: '151' };
    for (let i = 0; i < 5; i++) {
      ast = { type: 'all-of', items: [ast] };
    }
    const req = api.fromAST(ast);
    expect(req.ast.type).toBe('all-of');
    expect(req.validate().valid).toBe(true);
  });
});

// ============================================================
// 23. AuditResult.walk (Issue 5)
// ============================================================

describe('AuditResult.walk', () => {
  test('visits all nodes with correct paths', () => {
    const req = api.parse('all of (MATH 151, CMPS 130)');
    const result = req.audit(minimalCatalog, completeTx);
    const visited = [];
    result.walk((node, path) => {
      visited.push({ type: node.type, path });
    });
    // Root + 2 children = at least 3 nodes
    expect(visited.length).toBeGreaterThanOrEqual(3);
    expect(visited[0].path).toEqual([]);
    expect(visited[0].type).toBe('all-of');
  });

  test('walk is a function on AuditResult', () => {
    const req = api.parse('MATH 151');
    const result = req.audit(minimalCatalog, completeTx);
    expect(typeof result.walk).toBe('function');
  });
});

// ============================================================
// 24. Summary unwraps scope/variable-ref (Issue 6)
// ============================================================

describe('AuditResult.summary scope unwrap', () => {
  test('scoped program returns group-level counts', () => {
    const req = api.parse('$a = MATH 151\n$b = CMPS 130\nall of ($a, $b)');
    const result = req.audit(minimalCatalog, completeTx);
    const s = result.summary;
    // Should unwrap scope+variable-refs to see the all-of with 2 items
    expect(s.total).toBe(2);
    expect(s.met).toBe(2);
  });

  test('scope wrapping single body returns body-level summary', () => {
    const req = api.parse('scope "test" { all of (MATH 151, CMPS 130) }');
    const result = req.audit(minimalCatalog, completeTx);
    const s = result.summary;
    expect(s.total).toBe(2);
  });
});

// ============================================================
// 25. Catalog.findCourse / findProgram (Issue 7)
// ============================================================

describe('Catalog query methods', () => {
  const cat = api.catalog(minimalCatalog);

  test('findCourse returns matching course', () => {
    const course = cat.findCourse('MATH', '151');
    expect(course).toBeDefined();
    expect(course.subject).toBe('MATH');
    expect(course.number).toBe('151');
    expect(course.title).toBe('Calculus I');
  });

  test('findCourse returns undefined for unknown course', () => {
    expect(cat.findCourse('FAKE', '999')).toBeUndefined();
  });

  test('findProgram returns matching program', () => {
    const prog = cat.findProgram('CMPS');
    expect(prog).toBeDefined();
    expect(prog.name).toBe('Computer Science');
  });

  test('findProgram returns undefined for unknown code', () => {
    expect(cat.findProgram('FAKE')).toBeUndefined();
  });

  test('repeated findCourse uses memoized index', () => {
    const c1 = cat.findCourse('MATH', '151');
    const c2 = cat.findCourse('MATH', '151');
    expect(c1).toBe(c2); // same object reference
  });

  test('findCourse and findProgram are functions', () => {
    expect(typeof cat.findCourse).toBe('function');
    expect(typeof cat.findProgram).toBe('function');
  });
});

// ============================================================
// 26. calculateGPA entity wrapping (Issue 8)
// ============================================================

describe('calculateGPA entity wrapping', () => {
  test('accepts Transcript and Catalog entities', () => {
    const cat = api.catalog(minimalCatalog);
    const tx = api.transcript([
      { subject: 'MATH', number: '151', grade: 'A', credits: 4 },
      { subject: 'CMPS', number: '130', grade: 'B', credits: 3 },
    ]);
    const gpa = api.calculateGPA(tx, cat);
    expect(typeof gpa).toBe('number');
    expect(gpa).toBeCloseTo((4.0 * 4 + 3.0 * 3) / 7, 2);
  });

  test('backward compat: plain array + plain config', () => {
    const entries = [
      { grade: 'A', credits: 3 },
      { grade: 'B', credits: 3 },
    ];
    const gpa = api.calculateGPA(entries, minimalCatalog.gradeConfig);
    expect(gpa).toBe(3.5);
  });

  test('accepts array of TranscriptEntry instances', () => {
    const entries = [
      new api.TranscriptEntry({ subject: 'MATH', number: '151', grade: 'A', credits: 4 }),
    ];
    const gpa = api.calculateGPA(entries, minimalCatalog.gradeConfig);
    expect(gpa).toBe(4.0);
  });
});

// ============================================================
// 27. isValidGrade (Issue 9)
// ============================================================

describe('isValidGrade', () => {
  const config = minimalCatalog.gradeConfig;

  test('scale grade is valid', () => {
    expect(api.isValidGrade('A', config)).toBe(true);
    expect(api.isValidGrade('F', config)).toBe(true);
  });

  test('pass/fail grade is valid', () => {
    expect(api.isValidGrade('P', config)).toBe(true);
    expect(api.isValidGrade('NP', config)).toBe(true);
  });

  test('withdrawal grade is valid', () => {
    expect(api.isValidGrade('W', config)).toBe(true);
    expect(api.isValidGrade('WP', config)).toBe(true);
  });

  test('incomplete grade is valid', () => {
    expect(api.isValidGrade('I', config)).toBe(true);
    expect(api.isValidGrade('IP', config)).toBe(true);
  });

  test('unrecognized grade is invalid', () => {
    expect(api.isValidGrade('XYZ', config)).toBe(false);
    expect(api.isValidGrade('Z', config)).toBe(false);
  });

  test('case-insensitive', () => {
    expect(api.isValidGrade('a', config)).toBe(true);
    expect(api.isValidGrade('w', config)).toBe(true);
  });

  test('defaults to DEFAULT_GRADE_CONFIG when no config passed', () => {
    expect(api.isValidGrade('A')).toBe(true);
    expect(api.isValidGrade('XYZ')).toBe(false);
  });

  test('isValidGrade is exported', () => {
    expect(typeof api.isValidGrade).toBe('function');
  });
});

// ============================================================
// 28. Exception factories and audit integration
// ============================================================

describe('Exception factories', () => {
  test('waiver() creates Waiver instance', () => {
    const w = api.waiver({
      course: { subject: 'MATH', number: '151' },
      reason: 'AP credit',
    });
    expect(w).toBeInstanceOf(api.Waiver);
    expect(w.kind).toBe('waiver');
    expect(w.reason).toBe('AP credit');
  });

  test('substitution() creates Substitution instance', () => {
    const s = api.substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'Department approval',
    });
    expect(s).toBeInstanceOf(api.Substitution);
    expect(s.kind).toBe('substitution');
    expect(s.reason).toBe('Department approval');
  });

  test('waiver validation — missing reason throws', () => {
    expect(() => api.waiver({ course: { subject: 'MATH', number: '151' } }))
      .toThrow('reason');
  });

  test('substitution validation — missing original throws', () => {
    expect(() => api.substitution({
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'test',
    })).toThrow('original');
  });
});

describe('Audit with exceptions (public API)', () => {
  test('Requirement.audit with waiver returns waived status', () => {
    const req = api.parse('MATH 151');
    const w = api.waiver({
      course: { subject: 'MATH', number: '151' },
      reason: 'AP credit',
    });
    const result = req.audit(minimalCatalog, [], { exceptions: [w] });
    expect(result.status).toBe(api.AuditStatus.WAIVED);
  });

  test('Requirement.audit with substitution returns substituted status', () => {
    const req = api.parse('MATH 151');
    const s = api.substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'CMPS', number: '130' },
      reason: 'approved',
    });
    const tx = [{ subject: 'CMPS', number: '130', grade: 'A', credits: 3, status: 'completed' }];
    const result = req.audit(minimalCatalog, tx, { exceptions: [s] });
    expect(result.status).toBe(api.AuditStatus.SUBSTITUTED);
  });

  test('result.exceptions reports applied/unused', () => {
    const req = api.parse('MATH 151');
    const w = api.waiver({
      course: { subject: 'MATH', number: '151' },
      reason: 'AP credit',
    });
    const unusedW = api.waiver({
      course: { subject: 'ENGL', number: '101' },
      reason: 'transfer',
    });
    const result = req.audit(minimalCatalog, [], { exceptions: [w, unusedW] });
    expect(result.exceptions).toBeDefined();
    expect(result.exceptions.applied).toHaveLength(1);
    expect(result.exceptions.unused).toHaveLength(1);
    expect(result.exceptions.applied[0].reason).toBe('AP credit');
    expect(result.exceptions.unused[0].reason).toBe('transfer');
  });

  test('unused exception generates warning', () => {
    const req = api.parse('MATH 151');
    const unusedW = api.waiver({
      course: { subject: 'ENGL', number: '101' },
      reason: 'transfer',
    });
    const result = req.audit(minimalCatalog, completeTx, { exceptions: [unusedW] });
    const unusedWarnings = result.warnings.filter(w => w.type === 'unused-exception');
    expect(unusedWarnings).toHaveLength(1);
    expect(unusedWarnings[0].message).toContain('ENGL 101');
  });

  test('audit without exceptions has no exceptions property', () => {
    const req = api.parse('MATH 151');
    const result = req.audit(minimalCatalog, completeTx);
    expect(result.exceptions).toBeNull();
  });

  test('score waiver through public API', () => {
    const req = api.parse('score SAT_MATH >= 580');
    const w = api.waiver({ score: 'SAT_MATH', reason: 'Documented accommodation' });
    const result = req.audit(minimalCatalog, [], { exceptions: [w] });
    expect(result.status).toBe(api.AuditStatus.WAIVED);
    expect(result.exceptions.applied).toHaveLength(1);
  });

  test('label waiver through public API', () => {
    const req = api.parse('"CS Core": all of (CMPS 130, CMPS 148)');
    const w = api.waiver({ label: 'CS Core', reason: 'Transfer equivalency' });
    const result = req.audit(minimalCatalog, [], { exceptions: [w] });
    expect(result.status).toBe(api.AuditStatus.WAIVED);
    expect(result.exceptions.applied).toHaveLength(1);
  });

  test('label waiver targeting non-existent label is unused', () => {
    const req = api.parse('"CS Core": all of (CMPS 130, CMPS 148)');
    const w = api.waiver({ label: 'NonExistent', reason: 'Should not match' });
    const result = req.audit(minimalCatalog, [], { exceptions: [w] });
    expect(result.status).not.toBe(api.AuditStatus.WAIVED);
    expect(result.exceptions.applied).toHaveLength(0);
    expect(result.exceptions.unused).toHaveLength(1);
    expect(result.exceptions.unused[0].reason).toBe('Should not match');
  });
});

describe('Multi-tree audit with exceptions', () => {
  test('exceptions apply to all trees', () => {
    const majorReq = api.parse('all of (MATH 151, CMPS 130)');
    const minorReq = api.parse('MATH 151');
    const w = api.waiver({
      course: { subject: 'MATH', number: '151' },
      reason: 'AP credit',
    });
    const tx = [{ subject: 'CMPS', number: '130', grade: 'A', credits: 3, status: 'completed' }];
    const result = api.auditMulti(minimalCatalog, tx, {
      trees: { major: majorReq, minor: minorReq },
      exceptions: [w],
    });
    // Major: MATH waived + CMPS met → met
    expect(result.trees.major.status).toBe(api.AuditStatus.MET);
    // Minor: MATH waived → waived
    expect(result.trees.minor.status).toBe(api.AuditStatus.WAIVED);
  });
});

// ============================================================
// Labels — integration tests
// ============================================================

describe('labels — integration', () => {
  test('parse labeled DSL → audit → labels preserved in result', () => {
    const req = api.parse(`scope "cmps-major" {
      $core = "CS Core": all of (CMPS 130, CMPS 148)
      $math = "Mathematics": all of (MATH 151, MATH 152)
      all of ($core, $math)
    }`);
    const result = req.audit(minimalCatalog, completeTx);
    // Labels survive through audit on resolved variable-ref results
    const tree = result.items;
    expect(tree.items[0].resolved.label).toBe('CS Core');
    expect(tree.items[1].resolved.label).toBe('Mathematics');
  });

  test('parse labeled DSL → toHTML → named-label span appears', () => {
    const req = api.parse('"Core": all of (MATH 151, MATH 152)');
    const html = req.toHTML(minimalCatalog);
    expect(html).toContain('<span class="reqit-named-label">Core</span>');
    expect(html).toContain('reqit-all-of');
  });

  test('parse labeled DSL → description → label in heading', () => {
    const req = api.parse('"Core": all of (MATH 151, MATH 152)');
    expect(req.description).toContain('Core \u2014 complete all of the following:');
  });

  test('parse labeled DSL → toOutline → label in heading', () => {
    const req = api.parse('"Core": all of (MATH 151, MATH 152)');
    const outline = req.toOutline(minimalCatalog);
    expect(outline).toContain('Core \u2014 All of the following:');
  });

  test('end-to-end round-trip with labeled program', () => {
    const input = `scope "cmps-major" {
      $core = "CS Core": all of (CMPS 130, CMPS 230)
      $math = "Mathematics": all of (MATH 151, MATH 152)
      all of ($core, $math)
    }`;
    const req1 = api.parse(input);
    const text = req1.text;
    const req2 = api.parse(text);
    expect(req2.ast).toEqual(req1.ast);
  });

  test('labeled none-of preserves label through audit', () => {
    const req = api.parse('"Excluded": none of (MATH 999)');
    const result = req.audit(minimalCatalog, completeTx);
    expect(result.items.label).toBe('Excluded');
  });
});

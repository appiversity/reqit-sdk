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
  const expectedFactories = ['parse', 'fromAST', 'course', 'program', 'attribute', 'declaredProgram', 'catalog', 'transcript', 'degree', 'waiver', 'substitution', 'sharedDefinition'];
  const expectedClasses = [
    'Requirement', 'Course', 'Program', 'Attribute', 'DeclaredProgram',
    'SharedDefinition',
    'Catalog', 'Degree', 'Transcript', 'TranscriptCourse',
    'ResolutionResult', 'AuditResult', 'MultiAuditResult',
    'Waiver', 'Substitution',
  ];
  const expectedModuleFunctions = [
    'auditMulti', 'exportPrereqMatrix', 'exportDependencyMatrix',
    'meetsMinGrade', 'isPassingGrade', 'calculateGPA', 'isValidGrade',
  ];
  const expectedMeta = ['version'];

  test.each(expectedFactories)('%s is exported as a function', (name) => {
    expect(typeof api[name]).toBe('function');
  });

  test.each(expectedClasses)('%s is exported as a constructor', (name) => {
    expect(typeof api[name]).toBe('function');
  });

  test.each(expectedModuleFunctions)('%s is exported as a function', (name) => {
    expect(typeof api[name]).toBe('function');
  });

  test.each(expectedMeta)('%s is exported', (name) => {
    expect(api[name]).toBeDefined();
  });

  test('version matches package.json', () => {
    const pkg = require('../../package.json');
    expect(api.version).toBe(pkg.version);
  });

  test('internal-use exports are NOT on the public API', () => {
    expect(api.CourseAssignmentMap).toBeUndefined();
    expect(api.prepareAudit).toBeUndefined();
    expect(api.isAuditableGrade).toBeUndefined();
    expect(api.DEFAULT_GRADE_CONFIG).toBeUndefined();
  });

  test('AuditStatus is exported with all six values', () => {
    expect(api.AuditStatus).toBeDefined();
    expect(api.AuditStatus.MET).toBe('met');
    expect(api.AuditStatus.PROVISIONAL_MET).toBe('provisional-met');
    expect(api.AuditStatus.IN_PROGRESS).toBe('in-progress');
    expect(api.AuditStatus.NOT_MET).toBe('not-met');
    expect(api.AuditStatus.WAIVED).toBe('waived');
    expect(api.AuditStatus.SUBSTITUTED).toBe('substituted');
  });

  test('ProgramType is exported with all six values', () => {
    expect(api.ProgramType).toBeDefined();
    expect(api.ProgramType.MAJOR).toBe('major');
    expect(api.ProgramType.MINOR).toBe('minor');
    expect(api.ProgramType.CERTIFICATE).toBe('certificate');
    expect(api.ProgramType.CONCENTRATION).toBe('concentration');
    expect(api.ProgramType.TRACK).toBe('track');
    expect(api.ProgramType.CLUSTER).toBe('cluster');
    expect(Object.isFrozen(api.ProgramType)).toBe(true);
  });

  test('ProgramLevel is exported with all six values', () => {
    expect(api.ProgramLevel).toBeDefined();
    expect(api.ProgramLevel.UNDERGRADUATE).toBe('undergraduate');
    expect(api.ProgramLevel.GRADUATE).toBe('graduate');
    expect(api.ProgramLevel.DOCTORAL).toBe('doctoral');
    expect(api.ProgramLevel.PROFESSIONAL).toBe('professional');
    expect(api.ProgramLevel.POST_GRADUATE).toBe('post-graduate');
    expect(api.ProgramLevel.POST_DOCTORAL).toBe('post-doctoral');
    expect(Object.isFrozen(api.ProgramLevel)).toBe(true);
  });

  test('DegreeType is exported with common degree types', () => {
    expect(api.DegreeType).toBeDefined();
    expect(api.DegreeType.BS).toBe('B.S.');
    expect(api.DegreeType.BA).toBe('B.A.');
    expect(api.DegreeType.MA).toBe('M.A.');
    expect(api.DegreeType.MS).toBe('M.S.');
    expect(api.DegreeType.PHD).toBe('Ph.D.');
    expect(api.DegreeType.MBA).toBe('M.B.A.');
    expect(api.DegreeType.JD).toBe('J.D.');
    expect(api.DegreeType.MD).toBe('M.D.');
    // Associate degrees
    expect(api.DegreeType.AA).toBe('A.A.');
    expect(api.DegreeType.AS).toBe('A.S.');
    // Professional degrees
    expect(api.DegreeType.DO).toBe('D.O.');
    expect(api.DegreeType.DDS).toBe('D.D.S.');
    expect(Object.isFrozen(api.DegreeType)).toBe(true);
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
// 6b. ResolutionResult enrichment (Issue 7)
// ============================================================

describe('ResolutionResult enrichment', () => {
  test('allCourses deduplicates explicit and filter-matched courses', () => {
    // MATH 151 appears explicitly AND would be matched by "courses where subject = MATH"
    const req = api.parse('all of (MATH 151, courses where subject = "MATH")');
    const result = req.resolve(minimalCatalog);
    const all = result.allCourses();
    const keys = all.map(c => `${c.subject}:${c.number}`);
    const unique = new Set(keys);
    expect(keys.length).toBe(unique.size); // no duplicates
  });

  test('coursesForFilter returns matched courses for a specific filter', () => {
    const req = api.parse('courses where subject = "CMPS"');
    const result = req.resolve(minimalCatalog);
    const matched = result.coursesForFilter(0);
    expect(matched).toHaveLength(11);
    expect(matched.every(c => c.subject === 'CMPS')).toBe(true);
  });

  test('coursesForFilter returns empty array for out-of-range index', () => {
    const req = api.parse('courses where subject = "CMPS"');
    const result = req.resolve(minimalCatalog);
    expect(result.coursesForFilter(99)).toEqual([]);
  });

  test('filtersForCourse returns which filters matched a course', () => {
    const req = api.parse('all of (courses where subject = "CMPS", courses where attribute = "WI")');
    const result = req.resolve(minimalCatalog);
    // CMPS 310 has attribute WI and subject CMPS — matched by both filters
    const matches = result.filtersForCourse('CMPS', '310');
    expect(matches.length).toBe(2);
    expect(matches[0]).toHaveProperty('index');
    expect(matches[0]).toHaveProperty('node');
  });

  test('filtersForCourse returns empty array for unmatched course', () => {
    const req = api.parse('courses where subject = "CMPS"');
    const result = req.resolve(minimalCatalog);
    expect(result.filtersForCourse('MATH', '151')).toEqual([]);
  });

  test('totalUniqueCourses returns count', () => {
    const req = api.parse('all of (MATH 151, MATH 152)');
    const result = req.resolve(minimalCatalog);
    expect(result.totalUniqueCourses).toBe(2);
  });

  test('subjects returns Set of subject codes', () => {
    const req = api.parse('all of (MATH 151, CMPS 130)');
    const result = req.resolve(minimalCatalog);
    expect(result.subjects).toEqual(new Set(['MATH', 'CMPS']));
  });

  test('subjects includes filter-matched subjects', () => {
    const req = api.parse('courses where attribute = "FA"');
    const result = req.resolve(minimalCatalog);
    expect(result.subjects).toContain('ART');
  });

  test('warnings is empty array when no issues', () => {
    const req = api.parse('courses where attribute = "WI"');
    const result = req.resolve(minimalCatalog);
    expect(result.warnings).toEqual([]);
  });

  test('warnings includes unknown attribute code', () => {
    const req = api.parse('courses where attribute = "FAKE"');
    const result = req.resolve(minimalCatalog);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('FAKE');
    expect(result.warnings[0]).toContain('Unknown attribute code');
  });

  test('warnings for multiple unknown attributes in separate filters', () => {
    const req = api.parse('all of (courses where attribute = "NOPE", courses where attribute = "ALSO_FAKE")');
    const result = req.resolve(minimalCatalog);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toContain('NOPE');
    expect(result.warnings[1]).toContain('ALSO_FAKE');
  });

  test('no warning when catalog has no attributes registry', () => {
    const catNoAttrs = { ...minimalCatalog, attributes: undefined };
    const req = api.parse('courses where attribute = "FAKE"');
    const result = req.resolve(catNoAttrs);
    expect(result.warnings).toEqual([]);
  });

  test('known attribute code produces no warning', () => {
    const req = api.parse('all of (courses where attribute = "QR", courses where attribute = "WI")');
    const result = req.resolve(minimalCatalog);
    expect(result.warnings).toEqual([]);
  });
});

// ============================================================
// 7. Single-tree audit
// ============================================================

describe('Single-tree audit', () => {
  test('audit(catalog, transcript) returns AuditResult', () => {
    const req = api.parse('MATH 151');
    const result = req.audit(minimalCatalog, api.transcript({ courses: completeTx }));
    expect(result).toBeInstanceOf(api.AuditResult);
  });

  test('result.status is an AuditStatus value', () => {
    const req = api.parse('MATH 151');
    const result = req.audit(minimalCatalog, api.transcript({ courses: completeTx }));
    expect(Object.values(api.AuditStatus)).toContain(result.status);
  });

  test('result.results is the annotated tree', () => {
    const req = api.parse('MATH 151');
    const result = req.audit(minimalCatalog, api.transcript({ courses: completeTx }));
    expect(result.results).toBeDefined();
    expect(result.results.type).toBe('course');
  });

  test('result.summary has met, notMet, provisionalMet, inProgress', () => {
    const req = api.parse('all of (MATH 151, CMPS 130)');
    const result = req.audit(minimalCatalog, api.transcript({ courses: completeTx }));
    const s = result.summary;
    expect(s).toHaveProperty('met');
    expect(s).toHaveProperty('notMet');
    expect(s).toHaveProperty('provisionalMet');
    expect(s).toHaveProperty('inProgress');
  });

  test('result.warnings is an array', () => {
    const req = api.parse('MATH 151');
    const result = req.audit(minimalCatalog, api.transcript({ courses: completeTx }));
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  test('result.findUnmet() returns unmet leaf nodes', () => {
    const req = api.parse('all of (MATH 151, CMPS 310)');
    const result = req.audit(minimalCatalog, api.transcript({ courses: partialTx }));
    const unmet = result.findUnmet();
    expect(Array.isArray(unmet)).toBe(true);
    expect(unmet).toHaveLength(1);
  });

  test('result.findNextEligible(catalog, transcript) returns eligible courses', () => {
    const req = api.parse('all of (MATH 151, CMPS 310)');
    const result = req.audit(minimalCatalog, api.transcript({ courses: partialTx }));
    const eligible = result.findNextEligible(minimalCatalog, api.transcript({ courses: partialTx }));
    expect(Array.isArray(eligible)).toBe(true);
  });

  test('result.toHTML(catalog) returns HTML with status classes', () => {
    const req = api.parse('MATH 151');
    const result = req.audit(minimalCatalog, api.transcript({ courses: completeTx }));
    const html = result.toHTML(minimalCatalog);
    expect(typeof html).toBe('string');
    expect(html).toContain('reqit-status-met');
  });

  test('result.export(catalog, { format: "csv" }) returns CSV string', () => {
    const req = api.parse('all of (MATH 151, CMPS 130)');
    const result = req.audit(minimalCatalog, api.transcript({ courses: completeTx }));
    const csv = result.export(minimalCatalog, { format: 'csv' });
    expect(typeof csv).toBe('string');
    expect(csv).toContain('MATH');
  });

  test('works with Catalog/Transcript entities', () => {
    const req = api.parse('MATH 151');
    const cat = api.catalog(minimalCatalog);
    const tx = api.transcript(api.transcript({ courses: completeTx }));
    const result = req.audit(cat, tx);
    expect(result.status).toBe(api.AuditStatus.MET);
  });

  test('options: attainments (scores, booleans)', () => {
    const req = api.parse('score SAT >= 1200');
    const tx = api.transcript({ courses: [], attainments: { SAT: { kind: 'score', value: 1300 } } });
    const result = req.audit(minimalCatalog, tx);
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

  test('AuditStatus.PROVISIONAL_MET === "provisional-met"', () => {
    expect(api.AuditStatus.PROVISIONAL_MET).toBe('provisional-met');
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
// 9b. Catalog.withPrograms()
// ============================================================

describe('Catalog.withPrograms()', () => {
  const cat = api.catalog(minimalCatalog);

  test('returns a new Catalog instance', () => {
    const enriched = cat.withPrograms({});
    expect(enriched).toBeInstanceOf(api.Catalog);
    expect(enriched).not.toBe(cat);
  });

  test('original catalog is not mutated', () => {
    const mathReq = api.parse('all of (MATH 151, MATH 152)');
    cat.withPrograms({ 'CMPS': mathReq });
    // Original should not have requirements on any program
    const original = cat.findProgram('CMPS');
    expect(original).toBeDefined();
    expect(original.requirements).toBeUndefined();
  });

  test('attaches requirements to matching programs', () => {
    const mathReq = api.parse('all of (MATH 151, MATH 152)');
    const enriched = cat.withPrograms({ 'CMPS': mathReq });
    const prog = enriched.findProgram('CMPS');
    expect(prog).toBeDefined();
    expect(prog.requirements).toBeDefined();
    expect(prog.requirements.type).toBe('all-of');
  });

  test('programs not in map are unchanged', () => {
    const enriched = cat.withPrograms({ 'CMPS': api.parse('MATH 151') });
    const minor = enriched.findProgram('CMPS-MINOR');
    expect(minor).toBeDefined();
    expect(minor.requirements).toBeUndefined();
  });

  test('adds programs not already in the catalog', () => {
    const newReq = api.parse('MATH 151');
    const enriched = cat.withPrograms({ 'NEW-PROG': newReq });
    const prog = enriched.findProgram('NEW-PROG');
    expect(prog).toBeDefined();
    expect(prog.code).toBe('NEW-PROG');
    expect(prog.requirements).toBeDefined();
    expect(prog.requirements.type).toBe('course');
  });

  test('accepts raw ASTs as well as Requirement instances', () => {
    const rawAst = { type: 'course', subject: 'MATH', number: '151' };
    const enriched = cat.withPrograms({ 'CMPS': rawAst });
    const prog = enriched.findProgram('CMPS');
    expect(prog.requirements).toEqual(rawAst);
  });

  test('enriched catalog enables program-ref sub-audits', () => {
    const minorReq = api.parse('all of (MATH 151, MATH 152)');
    const enriched = cat.withPrograms({ 'CMPS-MINOR': minorReq });

    const mainReq = api.parse('all of (CMPS 130, program "CMPS-MINOR")');
    const tx = api.transcript({
      courses: [
        { subject: 'CMPS', number: '130', grade: 'A', credits: 3, status: 'completed' },
        { subject: 'MATH', number: '151', grade: 'A', credits: 4, status: 'completed' },
        { subject: 'MATH', number: '152', grade: 'B', credits: 4, status: 'completed' },
      ],
      declaredPrograms: [{ code: 'CMPS-MINOR', type: 'minor', level: 'undergraduate' }],
    });

    const result = mainReq.audit(enriched, tx);
    expect(result.status).toBe('met');
  });
});

// ============================================================
// 10. TranscriptCourse entity
// ============================================================

describe('TranscriptCourse entity', () => {
  test('constructor wraps plain object', () => {
    const entry = new api.TranscriptCourse({ subject: 'MATH', number: '151', grade: 'A', credits: 4 });
    expect(entry.subject).toBe('MATH');
    expect(entry.number).toBe('151');
  });

  test('missing subject/number throws', () => {
    expect(() => new api.TranscriptCourse({})).toThrow('TranscriptCourse requires subject and number');
    expect(() => new api.TranscriptCourse({ subject: 'MATH' })).toThrow();
  });

  test('getters return correct values', () => {
    const entry = new api.TranscriptCourse({
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
    const entry = new api.TranscriptCourse({ subject: 'MATH', number: '151' });
    expect(entry.grade).toBeNull();
    expect(entry.credits).toBe(0);
    expect(entry.term).toBe('');
    expect(entry.status).toBe('completed');
  });

  test('toJSON() returns plain object', () => {
    const data = { subject: 'MATH', number: '151', grade: 'A', credits: 4 };
    const entry = new api.TranscriptCourse(data);
    const json = entry.toJSON();
    expect(json).toEqual(data);
    expect(json).not.toBe(data); // new object
  });

  test('entry data is frozen', () => {
    const entry = new api.TranscriptCourse({ subject: 'MATH', number: '151' });
    // The internal data is frozen, so the entry getters are stable
    expect(entry.subject).toBe('MATH');
  });
});

// ============================================================
// 11. Transcript entity
// ============================================================

describe('Transcript entity', () => {
  test('transcript({ courses }) returns Transcript instance', () => {
    const tx = api.transcript(api.transcript({ courses: completeTx }));
    expect(tx).toBeInstanceOf(api.Transcript);
  });

  test('non-object throws', () => {
    expect(() => api.transcript('not-object')).toThrow('courses');
  });

  test('transcript.courses is frozen array of TranscriptCourse instances', () => {
    const tx = api.transcript(api.transcript({ courses: completeTx }));
    expect(Object.isFrozen(tx.courses)).toBe(true);
    expect(tx.courses[0]).toBeInstanceOf(api.TranscriptCourse);
  });

  test('plain objects in constructor are wrapped as TranscriptCourse', () => {
    const tx = api.transcript({ courses: [{ subject: 'MATH', number: '151', grade: 'A', credits: 4 }] });
    expect(tx.courses[0]).toBeInstanceOf(api.TranscriptCourse);
  });

  test('addCourse(plain) returns new Transcript with entry appended', () => {
    const tx = api.transcript(api.transcript({ courses: completeTx }));
    const tx2 = tx.addCourse({ subject: 'NEW', number: '999', grade: 'B', credits: 3 });
    expect(tx2).toBeInstanceOf(api.Transcript);
    expect(tx2.courses).toHaveLength(tx.courses.length + 1);
    expect(tx2.courses[tx2.courses.length - 1].subject).toBe('NEW');
  });

  test('addCourse(TranscriptCourse) returns new Transcript', () => {
    const tx = api.transcript(api.transcript({ courses: completeTx }));
    const entry = new api.TranscriptCourse({ subject: 'NEW', number: '999' });
    const tx2 = tx.addCourse(entry);
    expect(tx2.courses[tx2.courses.length - 1].subject).toBe('NEW');
  });

  test('removeCourse(subject, number) returns new Transcript without matching entries', () => {
    const tx = api.transcript(api.transcript({ courses: completeTx }));
    const before = tx.courses.length;
    const tx2 = tx.removeCourse('MATH', '151');
    expect(tx2.courses.length).toBeLessThan(before);
    expect(tx2.courses.find(e => e.subject === 'MATH' && e.number === '151')).toBeUndefined();
  });

  test('original transcript unchanged after add/remove (immutability)', () => {
    const tx = api.transcript(api.transcript({ courses: completeTx }));
    const originalLength = tx.courses.length;
    tx.addCourse({ subject: 'NEW', number: '999' });
    tx.removeCourse('MATH', '151');
    expect(tx.courses).toHaveLength(originalLength);
  });

  test('methods accept Transcript entity', () => {
    const req = api.parse('MATH 151');
    const cat = api.catalog(minimalCatalog);
    const tx = api.transcript(api.transcript({ courses: completeTx }));
    const result = req.audit(cat, tx);
    expect(result.status).toBe(api.AuditStatus.MET);
  });

  test('methods accept plain transcript objects', () => {
    const req = api.parse('MATH 151');
    const result = req.audit(minimalCatalog, api.transcript({ courses: completeTx }));
    expect(result.status).toBe(api.AuditStatus.MET);
  });
});

// ============================================================
// 11b. Transcript enrichment — attainments, declaredPrograms, waivers, substitutions, level
// ============================================================

describe('Transcript enrichment', () => {
  test('attainments default to empty object', () => {
    const tx = api.transcript({ courses: [] });
    expect(tx.attainments).toEqual({});
  });

  test('attainments are accessible', () => {
    const tx = api.transcript({
      courses: [],
      attainments: { 'SAT-MATH': { kind: 'score', value: 620 } },
    });
    expect(tx.attainments['SAT-MATH'].value).toBe(620);
  });

  test('addAttainment returns new Transcript with attainment added', () => {
    const tx = api.transcript({ courses: [] });
    const tx2 = tx.addAttainment('SAT-MATH', { kind: 'score', value: 620 });
    expect(tx2.attainments['SAT-MATH'].value).toBe(620);
    expect(tx.attainments['SAT-MATH']).toBeUndefined();
  });

  test('removeAttainment returns new Transcript without attainment', () => {
    const tx = api.transcript({
      courses: [],
      attainments: { 'SAT-MATH': { kind: 'score', value: 620 }, 'GPA': { kind: 'score', value: 3.5 } },
    });
    const tx2 = tx.removeAttainment('SAT-MATH');
    expect(tx2.attainments['SAT-MATH']).toBeUndefined();
    expect(tx2.attainments['GPA'].value).toBe(3.5);
  });

  test('declaredPrograms default to empty array', () => {
    const tx = api.transcript({ courses: [] });
    expect(tx.declaredPrograms).toEqual([]);
  });

  test('declaredPrograms are accessible', () => {
    const tx = api.transcript({
      courses: [],
      declaredPrograms: [
        { code: 'CMPS', type: 'major', level: 'undergraduate', role: 'primary' },
      ],
    });
    expect(tx.declaredPrograms).toHaveLength(1);
    expect(tx.declaredPrograms[0].code).toBe('CMPS');
    expect(tx.declaredPrograms[0].role).toBe('primary');
  });

  test('declareProgram returns new Transcript with program added', () => {
    const tx = api.transcript({ courses: [] });
    const tx2 = tx.declareProgram({ code: 'CMPS', type: 'major', level: 'undergraduate', role: 'primary' });
    expect(tx2.declaredPrograms).toHaveLength(1);
    expect(tx.declaredPrograms).toHaveLength(0);
  });

  test('undeclareProgram returns new Transcript without program', () => {
    const tx = api.transcript({
      courses: [],
      declaredPrograms: [
        { code: 'CMPS', type: 'major', level: 'undergraduate' },
        { code: 'MATH', type: 'minor', level: 'undergraduate' },
      ],
    });
    const tx2 = tx.undeclareProgram('CMPS');
    expect(tx2.declaredPrograms).toHaveLength(1);
    expect(tx2.declaredPrograms[0].code).toBe('MATH');
  });

  test('waivers default to empty array', () => {
    const tx = api.transcript({ courses: [] });
    expect(tx.waivers).toEqual([]);
  });

  test('addWaiver requires Waiver instance', () => {
    const tx = api.transcript({ courses: [] });
    expect(() => tx.addWaiver({ course: { subject: 'MATH', number: '151' } }))
      .toThrow('Waiver instance');
  });

  test('addWaiver/removeWaiver round-trip', () => {
    const tx = api.transcript({ courses: [] });
    const w = api.waiver({ course: { subject: 'MATH', number: '151' }, reason: 'Transfer' });
    const tx2 = tx.addWaiver(w);
    expect(tx2.waivers).toHaveLength(1);
    const tx3 = tx2.removeWaiver({ subject: 'MATH', number: '151' });
    expect(tx3.waivers).toHaveLength(0);
  });

  test('removeWaiver by string target (attainment, score, etc.)', () => {
    const tx = api.transcript({ courses: [] });
    const w = api.waiver({ attainment: 'PRAXIS', reason: 'Already certified' });
    const tx2 = tx.addWaiver(w);
    expect(tx2.waivers).toHaveLength(1);
    const tx3 = tx2.removeWaiver('PRAXIS');
    expect(tx3.waivers).toHaveLength(0);
  });

  test('substitutions default to empty array', () => {
    const tx = api.transcript({ courses: [] });
    expect(tx.substitutions).toEqual([]);
  });

  test('addSubstitution requires Substitution instance', () => {
    const tx = api.transcript({ courses: [] });
    expect(() => tx.addSubstitution({ original: { subject: 'MATH', number: '250' } }))
      .toThrow('Substitution instance');
  });

  test('addSubstitution/removeSubstitution round-trip', () => {
    const tx = api.transcript({ courses: [] });
    const s = api.substitution({
      original: { subject: 'MATH', number: '250' },
      replacement: { subject: 'MATH', number: '241' },
      reason: 'Transfer',
    });
    const tx2 = tx.addSubstitution(s);
    expect(tx2.substitutions).toHaveLength(1);
    const tx3 = tx2.removeSubstitution({ subject: 'MATH', number: '250' });
    expect(tx3.substitutions).toHaveLength(0);
  });

  test('level defaults to null', () => {
    const tx = api.transcript({ courses: [] });
    expect(tx.level).toBeNull();
  });

  test('level is accessible', () => {
    const tx = api.transcript({ courses: [], level: 'undergraduate' });
    expect(tx.level).toBe('undergraduate');
  });

  test('Transcript constructor rejects plain array', () => {
    expect(() => api.transcript([])).toThrow('courses');
  });

  test('waivers on transcript are used by audit()', () => {
    const req = api.parse('all of (MATH 151, CMPS 130)');
    const w = api.waiver({ course: { subject: 'CMPS', number: '130' }, reason: 'Transfer' });
    const tx = api.transcript({
      courses: [{ subject: 'MATH', number: '151', grade: 'A', credits: 4 }],
      waivers: [w],
    });
    const result = req.audit(minimalCatalog, tx);
    expect(result.status).toBe(api.AuditStatus.MET);
  });

  test('attainments on transcript are used by audit()', () => {
    const req = api.parse('score SAT_MATH >= 580');
    const tx = api.transcript({
      courses: [],
      attainments: { SAT_MATH: { kind: 'score', value: 620 } },
    });
    const result = req.audit(minimalCatalog, tx);
    expect(result.status).toBe(api.AuditStatus.MET);
  });

  test('declaredPrograms on transcript are used by audit()', () => {
    const cat = api.catalog({
      ...minimalCatalog,
      programs: [
        { code: 'MATH-MINOR', type: 'minor', level: 'undergraduate',
          requirements: api.parse('MATH 151').ast },
      ],
    });
    const req = api.parse('program "MATH-MINOR"');
    const tx = api.transcript({
      courses: [{ subject: 'MATH', number: '151', grade: 'A', credits: 4 }],
      declaredPrograms: [{ code: 'MATH-MINOR', type: 'minor', level: 'undergraduate' }],
    });
    const result = req.audit(cat, tx);
    expect(result.status).toBe(api.AuditStatus.MET);
  });

  test('mutation methods preserve all fields', () => {
    const w = api.waiver({ course: { subject: 'X', number: '1' }, reason: 'test' });
    const s = api.substitution({
      original: { subject: 'A', number: '1' },
      replacement: { subject: 'B', number: '1' },
      reason: 'test',
    });
    const tx = api.transcript({
      courses: [{ subject: 'MATH', number: '151', grade: 'A', credits: 4 }],
      attainments: { SAT: { kind: 'score', value: 600 } },
      declaredPrograms: [{ code: 'CS', type: 'major', level: 'undergraduate' }],
      waivers: [w],
      substitutions: [s],
      level: 'undergraduate',
    });

    // addCourse preserves all other fields
    const tx2 = tx.addCourse({ subject: 'NEW', number: '999', grade: 'B', credits: 3 });
    expect(tx2.attainments.SAT.value).toBe(600);
    expect(tx2.declaredPrograms).toHaveLength(1);
    expect(tx2.waivers).toHaveLength(1);
    expect(tx2.substitutions).toHaveLength(1);
    expect(tx2.level).toBe('undergraduate');
  });
});

// ============================================================
// 12. Multi-tree audit
// ============================================================

describe('Multi-tree audit', () => {
  const majorReq = api.parse('all of (MATH 151, CMPS 130)');
  const minorReq = api.parse('all of (CMPS 130, CMPS 230)');

  test('auditMulti(catalog, transcript, { trees }) returns MultiAuditResult', () => {
    const result = api.auditMulti(minimalCatalog, api.transcript({ courses: completeTx }), {
      trees: { major: majorReq, minor: minorReq },
    });
    expect(result).toBeInstanceOf(api.MultiAuditResult);
  });

  test('multi.trees is { name: AuditResult }', () => {
    const result = api.auditMulti(minimalCatalog, api.transcript({ courses: completeTx }), {
      trees: { major: majorReq, minor: minorReq },
    });
    const trees = result.trees;
    expect(trees.major).toBeInstanceOf(api.AuditResult);
    expect(trees.minor).toBeInstanceOf(api.AuditResult);
  });

  test('each tree entry has AuditResult methods (findUnmet, toHTML)', () => {
    const result = api.auditMulti(minimalCatalog, api.transcript({ courses: completeTx }), {
      trees: { major: majorReq },
    });
    const tree = result.trees.major;
    expect(typeof tree.findUnmet).toBe('function');
    expect(typeof tree.toHTML).toBe('function');
  });

  test('multi.overlapResults is an array', () => {
    const result = api.auditMulti(minimalCatalog, api.transcript({ courses: completeTx }), {
      trees: { major: majorReq },
    });
    expect(Array.isArray(result.overlapResults)).toBe(true);
  });

  test('multi.courseAssignments is a CourseAssignmentMap', () => {
    const advanced = require('../../src/advanced');
    const result = api.auditMulti(minimalCatalog, api.transcript({ courses: completeTx }), {
      trees: { major: majorReq },
    });
    expect(result.courseAssignments).toBeInstanceOf(advanced.CourseAssignmentMap);
  });

  test('multi.warnings is an array', () => {
    const result = api.auditMulti(minimalCatalog, api.transcript({ courses: completeTx }), {
      trees: { major: majorReq },
    });
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  test('works with Requirement values in trees map', () => {
    const result = api.auditMulti(minimalCatalog, api.transcript({ courses: completeTx }), {
      trees: { major: majorReq },
    });
    expect(result.trees.major.status).toBe(api.AuditStatus.MET);
  });

  test('works with plain AST values in trees map', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const result = api.auditMulti(minimalCatalog, api.transcript({ courses: completeTx }), {
      trees: { test: ast },
    });
    expect(result.trees.test.status).toBe(api.AuditStatus.MET);
  });

  test('programContext maps roles correctly', () => {
    const result = api.auditMulti(minimalCatalog, api.transcript({ courses: completeTx }), {
      trees: { major: majorReq, minor: minorReq },
      programContext: { 'primary-major': 'major', 'primary-minor': 'minor' },
    });
    expect(result.trees.major).toBeDefined();
    expect(result.trees.minor).toBeDefined();
  });

  test('auditMulti derives programContext from transcript declaredPrograms', () => {
    const tx = api.transcript({
      courses: completeTx,
      declaredPrograms: [
        { code: 'major', type: 'major', level: 'undergraduate', role: 'primary' },
        { code: 'minor', type: 'minor', level: 'undergraduate', role: 'primary' },
      ],
    });
    const result = api.auditMulti(minimalCatalog, tx, {
      trees: { major: majorReq, minor: minorReq },
      overlapRules: [{
        type: 'overlap-limit',
        left: { type: 'program-context-ref', role: 'primary-major' },
        right: { type: 'program-context-ref', role: 'primary-minor' },
        constraint: { comparison: 'at-most', value: 0, unit: 'courses' },
      }],
    });
    // CMPS 130 is shared → overlap > 0 → policy fails
    const overlap = result.overlapResults.find(r => r.type === 'overlap-limit');
    expect(overlap).toBeDefined();
    expect(overlap.status).toBe(api.AuditStatus.NOT_MET);
  });

  test('overlapRules are respected', () => {
    const result = api.auditMulti(minimalCatalog, api.transcript({ courses: completeTx }), {
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
    const result = req.audit(minimalCatalog, api.transcript({ courses: completeTx }));
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
      .audit(minimalCatalog, api.transcript({ courses: partialTx }))
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

  test('transcript("not-object") throws', () => {
    expect(() => api.transcript('not-object')).toThrow();
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
    const result = req.audit(cat, api.transcript({ courses: [{ subject: 'MATH', number: '151', grade: 'A', credits: 3, status: 'completed' }] }));
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
    expect(() => req.audit(minimalCatalog, api.transcript({ courses: completeTx }))).not.toThrow();
  });

  test('audit rejects plain transcript objects — requires Transcript instance', () => {
    const req = api.parse('MATH 151');
    expect(() => req.audit(minimalCatalog, { courses: completeTx }))
      .toThrow('Expected a Transcript instance');
  });

  test('findNextEligible rejects plain transcript objects — requires Transcript instance', () => {
    const req = api.parse('MATH 151');
    const result = req.audit(minimalCatalog, api.transcript({ courses: [] }));
    expect(() => result.findNextEligible(minimalCatalog, { courses: completeTx }))
      .toThrow('Expected a Transcript instance');
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
    const result = api.auditMulti(minimalCatalog, api.transcript({ courses: completeTx }), {
      trees: { a: ast, b: req },
    });
    expect(result.trees.a).toBeInstanceOf(api.AuditResult);
    expect(result.trees.b).toBeInstanceOf(api.AuditResult);
  });

  test('Transcript constructor accepts plain course objects', () => {
    const tx = api.transcript({ courses: [{ subject: 'MATH', number: '151', grade: 'A', credits: 3 }] });
    expect(tx.courses[0]).toBeInstanceOf(api.TranscriptCourse);
  });
});

// ============================================================
// 19. reqit/advanced subpath
// ============================================================

describe('reqit/advanced subpath', () => {
  const advanced = require('../../src/advanced');

  test('prepareAudit is exported and functional', () => {
    const ast = api.parse('MATH 151').ast;
    const prepared = advanced.prepareAudit(ast, minimalCatalog);
    expect(typeof prepared.run).toBe('function');
    const result = prepared.run(completeTx);
    expect(result.status).toBe('met');
  });

  test('CourseAssignmentMap is exported', () => {
    const cam = new advanced.CourseAssignmentMap();
    expect(typeof cam.assign).toBe('function');
  });

  test('isAuditableGrade is exported', () => {
    expect(typeof advanced.isAuditableGrade).toBe('function');
  });

  test('DEFAULT_GRADE_CONFIG is exported', () => {
    expect(advanced.DEFAULT_GRADE_CONFIG).toBeDefined();
    expect(advanced.DEFAULT_GRADE_CONFIG.scale).toBeDefined();
  });

  test('exports exactly four items', () => {
    const keys = Object.keys(advanced);
    expect(keys).toHaveLength(4);
    expect(keys.sort()).toEqual(['CourseAssignmentMap', 'DEFAULT_GRADE_CONFIG', 'isAuditableGrade', 'prepareAudit']);
  });
});

// ============================================================
// 20. AuditResult.summary correctness (F8)
// ============================================================

describe('AuditResult.summary correctness', () => {
  test('complete transcript — all met', () => {
    const req = api.parse('all of (MATH 151, CMPS 130)');
    const result = req.audit(minimalCatalog, api.transcript({ courses: completeTx }));
    expect(result.summary).toEqual({
      met: 2, waived: 0, substituted: 0, provisionalMet: 0, inProgress: 0, notMet: 0, total: 2,
    });
  });

  test('partial transcript — mixed met/not-met', () => {
    const req = api.parse('all of (MATH 151, CMPS 310)');
    const result = req.audit(minimalCatalog, api.transcript({ courses: partialTx }));
    expect(result.summary).toEqual({
      met: 1, waived: 0, substituted: 0, provisionalMet: 0, inProgress: 0, notMet: 1, total: 2,
    });
  });

  test('in-progress transcript — in-progress items', () => {
    const req = api.parse('all of (CMPS 310, CMPS 320)');
    const result = req.audit(minimalCatalog, api.transcript({ courses: inProgressTx }));
    expect(result.summary).toEqual({
      met: 0, waived: 0, substituted: 0, provisionalMet: 2, inProgress: 0, notMet: 0, total: 2,
    });
  });

  test('credits-from root — walks source.items', () => {
    const req = api.parse('at least 6 credits from (MATH 151, CMPS 130)');
    const result = req.audit(minimalCatalog, api.transcript({ courses: completeTx }));
    expect(result.summary).toEqual({
      met: 2, waived: 0, substituted: 0, provisionalMet: 0, inProgress: 0, notMet: 0, total: 2,
    });
  });

  test('leaf root — single item summary', () => {
    const req = api.parse('MATH 151');
    const result = req.audit(minimalCatalog, api.transcript({ courses: completeTx }));
    expect(result.summary).toEqual({
      met: 1, waived: 0, substituted: 0, provisionalMet: 0, inProgress: 0, notMet: 0, total: 1,
    });
  });
});

// ============================================================
// 21. MultiAuditResult.trees identity stability (F9)
// ============================================================

describe('MultiAuditResult.trees identity stability', () => {
  test('repeated access returns same object reference', () => {
    const multi = api.auditMulti(minimalCatalog, api.transcript({ courses: completeTx }), {
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
    const tx = api.transcript({ courses: [] });
    expect(tx.courses).toHaveLength(0);
  });

  test('TranscriptCourse preserves extra fields in toJSON()', () => {
    const entry = new api.TranscriptCourse({
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
    const result = req.audit(minimalCatalog, api.transcript({ courses: completeTx }));
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
    const result = req.audit(minimalCatalog, api.transcript({ courses: completeTx }));
    expect(typeof result.walk).toBe('function');
  });

  test('walk provides parent and depth', () => {
    const req = api.parse('all of (MATH 151, CMPS 130)');
    const result = req.audit(minimalCatalog, api.transcript({ courses: completeTx }));
    const visited = [];
    result.walk((node, path, parent, depth) => {
      visited.push({ type: node.type, parent, depth });
    });
    // Root: parent is null, depth is 0
    expect(visited[0].parent).toBeNull();
    expect(visited[0].depth).toBe(0);
    // Children: parent is the root all-of, depth is 1
    const children = visited.filter(v => v.type === 'course');
    expect(children).toHaveLength(2);
    children.forEach(c => {
      expect(c.parent).not.toBeNull();
      expect(c.parent.type).toBe('all-of');
      expect(c.depth).toBe(1);
    });
  });
});

// ============================================================
// 24. Summary unwraps scope/variable-ref (Issue 6)
// ============================================================

describe('AuditResult.summary scope unwrap', () => {
  test('scoped program returns group-level counts', () => {
    const req = api.parse('$a = MATH 151\n$b = CMPS 130\nall of ($a, $b)');
    const result = req.audit(minimalCatalog, api.transcript({ courses: completeTx }));
    const s = result.summary;
    // Should unwrap scope+variable-refs to see the all-of with 2 items
    expect(s.total).toBe(2);
    expect(s.met).toBe(2);
  });

  test('scope wrapping single body returns body-level summary', () => {
    const req = api.parse('scope "test" { all of (MATH 151, CMPS 130) }');
    const result = req.audit(minimalCatalog, api.transcript({ courses: completeTx }));
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

  test('findCourse returns null for unknown course', () => {
    expect(cat.findCourse('FAKE', '999')).toBeNull();
  });

  test('findProgram returns matching program', () => {
    const prog = cat.findProgram('CMPS');
    expect(prog).toBeDefined();
    expect(prog.name).toBe('Computer Science');
  });

  test('findProgram returns null for unknown code', () => {
    expect(cat.findProgram('FAKE')).toBeNull();
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
// 25a. Catalog.findCourses / getSubjects / getCrossListEquivalents (Issue 3)
// ============================================================

describe('Catalog course discovery methods', () => {
  const cat = api.catalog(minimalCatalog);

  test('findCourses with no filter returns all courses', () => {
    const all = cat.findCourses();
    expect(all).toHaveLength(minimalCatalog.courses.length);
  });

  test('findCourses with empty filter returns all courses', () => {
    expect(cat.findCourses({})).toHaveLength(minimalCatalog.courses.length);
  });

  test('findCourses by subject', () => {
    const math = cat.findCourses({ subject: 'MATH' });
    expect(math).toHaveLength(4);
    expect(math.every(c => c.subject === 'MATH')).toBe(true);
  });

  test('findCourses by attribute', () => {
    const wi = cat.findCourses({ attribute: 'WI' });
    // CMPS 310, CMPS 320, CMPS 360, ENGL 101, ENGL 201
    expect(wi).toHaveLength(5);
    expect(wi.every(c => c.attributes.includes('WI'))).toBe(true);
  });

  test('findCourses by subject and attribute', () => {
    const cmpsWI = cat.findCourses({ subject: 'CMPS', attribute: 'WI' });
    // CMPS 310, CMPS 320, CMPS 360
    expect(cmpsWI).toHaveLength(3);
    expect(cmpsWI.every(c => c.subject === 'CMPS' && c.attributes.includes('WI'))).toBe(true);
  });

  test('findCourses returns empty array for no matches', () => {
    expect(cat.findCourses({ subject: 'FAKE' })).toHaveLength(0);
    expect(cat.findCourses({ attribute: 'NONEXISTENT' })).toHaveLength(0);
  });

  test('findCourses returns new array each time', () => {
    const a = cat.findCourses({ subject: 'MATH' });
    const b = cat.findCourses({ subject: 'MATH' });
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  test('getSubjects returns sorted unique subject codes', () => {
    const subjects = cat.getSubjects();
    expect(subjects).toEqual(['ART', 'BIOL', 'CHEM', 'CMPS', 'ENGL', 'HIST', 'MATH', 'PHYS']);
  });

  test('getCrossListEquivalents returns empty for non-cross-listed course', () => {
    expect(cat.getCrossListEquivalents('MATH', '151')).toEqual([]);
  });

  test('getCrossListEquivalents returns empty for unknown course', () => {
    expect(cat.getCrossListEquivalents('FAKE', '999')).toEqual([]);
  });

  test('getCrossListEquivalents finds cross-listed courses', () => {
    // Add cross-listing to a custom catalog
    const crossListCatalog = api.catalog({
      ...minimalCatalog,
      courses: [
        ...minimalCatalog.courses,
        { id: 100, subject: 'CSE', number: '340', title: 'Intro to ML', creditsMin: 3, creditsMax: 3, crossListGroup: 'ML-INTRO' },
        { id: 101, subject: 'MATH', number: '340', title: 'Intro to ML', creditsMin: 3, creditsMax: 3, crossListGroup: 'ML-INTRO' },
      ],
    });
    const equiv = crossListCatalog.getCrossListEquivalents('CSE', '340');
    expect(equiv).toHaveLength(1);
    expect(equiv[0].subject).toBe('MATH');
    expect(equiv[0].number).toBe('340');
  });
});

// ============================================================
// 25d. Degree entity and catalog degree queries (Issue 5)
// ============================================================

describe('Degree entity', () => {
  test('degree() creates Degree instance', () => {
    const d = api.degree({ code: 'BS', name: 'Bachelor of Science', type: 'B.S.', level: 'undergraduate' });
    expect(d).toBeInstanceOf(api.Degree);
    expect(d.code).toBe('BS');
    expect(d.name).toBe('Bachelor of Science');
    expect(d.type).toBe('B.S.');
    expect(d.level).toBe('undergraduate');
  });

  test('Degree requires code', () => {
    expect(() => api.degree({ type: 'B.S.', level: 'undergraduate' })).toThrow('code');
  });

  test('Degree requires type', () => {
    expect(() => api.degree({ code: 'BS', level: 'undergraduate' })).toThrow('type');
  });

  test('Degree requires level', () => {
    expect(() => api.degree({ code: 'BS', type: 'B.S.' })).toThrow('level');
  });

  test('name defaults to null', () => {
    const d = api.degree({ code: 'BS', type: 'B.S.', level: 'undergraduate' });
    expect(d.name).toBeNull();
  });

  test('requirements defaults to null', () => {
    const d = api.degree({ code: 'BS', type: 'B.S.', level: 'undergraduate' });
    expect(d.requirements).toBeNull();
  });

  test('toJSON round-trips', () => {
    const data = { code: 'BS', name: 'Bachelor of Science', type: 'B.S.', level: 'undergraduate' };
    const d = api.degree(data);
    expect(d.toJSON()).toEqual(data);
  });

  test('data accessor returns frozen data', () => {
    const d = api.degree({ code: 'BS', type: 'B.S.', level: 'undergraduate' });
    expect(Object.isFrozen(d.data)).toBe(true);
  });
});

describe('Catalog degree queries', () => {
  const cat = api.catalog(minimalCatalog);

  test('degrees getter returns degrees array', () => {
    expect(cat.degrees).toHaveLength(3);
  });

  test('findDegree returns matching degree', () => {
    const d = cat.findDegree('BS');
    expect(d).toBeDefined();
    expect(d.code).toBe('BS');
    expect(d.name).toBe('Bachelor of Science');
  });

  test('findDegree returns null for unknown code', () => {
    expect(cat.findDegree('FAKE')).toBeNull();
  });

  test('findDegree uses memoized index', () => {
    const d1 = cat.findDegree('BS');
    const d2 = cat.findDegree('BS');
    expect(d1).toBe(d2);
  });

  test('findDegrees with no filter returns all', () => {
    expect(cat.findDegrees()).toHaveLength(3);
  });

  test('findDegrees by type', () => {
    const bs = cat.findDegrees({ type: 'B.S.' });
    expect(bs).toHaveLength(1);
    expect(bs[0].code).toBe('BS');
  });

  test('findDegrees by level', () => {
    const undergrad = cat.findDegrees({ level: 'undergraduate' });
    expect(undergrad).toHaveLength(2);
    const grad = cat.findDegrees({ level: 'graduate' });
    expect(grad).toHaveLength(1);
    expect(grad[0].code).toBe('MS');
  });

  test('findDegrees by type and level', () => {
    const result = cat.findDegrees({ type: 'B.A.', level: 'undergraduate' });
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('BA');
  });

  test('degrees defaults to empty array when catalog has none', () => {
    const cat2 = api.catalog({
      institution: 'test',
      ay: '2025-2026',
      courses: [{ id: 1, subject: 'X', number: '1', title: 'X', creditsMin: 1, creditsMax: 1 }],
    });
    expect(cat2.degrees).toEqual([]);
    expect(cat2.findDegrees()).toEqual([]);
    expect(cat2.findDegree('BS')).toBeNull();
  });
});

// ============================================================
// 25e. Reverse dependency queries (Issue 4)
// ============================================================

describe('Catalog.prereqGraph()', () => {
  const cat = api.catalog(minimalCatalog);
  const graph = cat.prereqGraph();

  test('directPrereqs returns direct prerequisites', () => {
    const prereqs = graph.directPrereqs('MATH:152');
    expect(prereqs).toEqual(new Set(['MATH:151']));
  });

  test('directPrereqs returns empty set for no prereqs', () => {
    expect(graph.directPrereqs('MATH:101').size).toBe(0);
  });

  test('directPrereqs returns empty set for unknown course', () => {
    expect(graph.directPrereqs('FAKE:999').size).toBe(0);
  });

  test('transitivePrereqs includes direct and indirect', () => {
    const prereqs = graph.transitivePrereqs('MATH:250');
    // MATH 250 requires MATH 152 which requires MATH 151
    expect(prereqs).toContain('MATH:152');
    expect(prereqs).toContain('MATH:151');
  });

  test('dependents returns direct reverse dependencies', () => {
    const deps = graph.dependents('MATH:151');
    expect(deps).toContain('MATH:152');
    expect(deps).toContain('PHYS:201');
  });

  test('transitiveDependents returns full reverse transitive closure', () => {
    const deps = graph.transitiveDependents('MATH:151');
    // MATH 151 → MATH 152 → MATH 250 → CMPS 350
    expect(deps).toContain('MATH:152');
    expect(deps).toContain('MATH:250');
    expect(deps).toContain('CMPS:350');
  });

  test('prereqGraph is cached', () => {
    const g1 = cat.prereqGraph();
    const g2 = cat.prereqGraph();
    expect(g1).toBe(g2);
  });
});

describe('Catalog.findProgramsRequiring()', () => {
  const cmpsMajor = api.parse('all of (CMPS 130, CMPS 230, MATH 151)');
  const mathMajor = api.parse('all of (MATH 151, MATH 152, any of (CMPS 130, CMPS 230))');
  const cat = api.catalog(minimalCatalog).withPrograms({
    CMPS: cmpsMajor,
    MATH: mathMajor,
  });

  test('finds programs requiring a course as required', () => {
    const results = cat.findProgramsRequiring('MATH', '151');
    const cmps = results.find(r => r.code === 'CMPS');
    const math = results.find(r => r.code === 'MATH');
    expect(cmps).toBeDefined();
    expect(cmps.context).toBe('required');
    expect(math).toBeDefined();
    expect(math.context).toBe('required');
  });

  test('identifies elective courses inside any-of', () => {
    const results = cat.findProgramsRequiring('CMPS', '130');
    const math = results.find(r => r.code === 'MATH');
    expect(math).toBeDefined();
    expect(math.context).toBe('elective');
  });

  test('returns empty array for unreferenced course', () => {
    expect(cat.findProgramsRequiring('ART', '101')).toHaveLength(0);
  });

  test('skips programs without requirements', () => {
    // CMPS-MINOR has no requirements attached
    const results = cat.findProgramsRequiring('CMPS', '130');
    const minor = results.find(r => r.code === 'CMPS-MINOR');
    expect(minor).toBeUndefined();
  });
});

describe('Catalog.courseImpact()', () => {
  const cmpsMajor = api.parse('all of (CMPS 130, CMPS 230, MATH 151)');
  const cat = api.catalog(minimalCatalog).withPrograms({ CMPS: cmpsMajor });

  test('returns dependent courses and programs', () => {
    const impact = cat.courseImpact('CMPS', '130');
    // CMPS 130 is a prereq for CMPS 230, which chains to CMPS 310, etc.
    expect(impact.dependentCourses).toContain('CMPS:230');
    expect(impact.dependentCourses.length).toBeGreaterThan(0);
    // CMPS program requires it
    expect(impact.programs).toHaveLength(1);
    expect(impact.programs[0].code).toBe('CMPS');
    expect(impact.programs[0].context).toBe('required');
  });

  test('returns empty arrays for isolated course', () => {
    const impact = cat.courseImpact('ART', '101');
    expect(impact.dependentCourses).toHaveLength(0);
    expect(impact.programs).toHaveLength(0);
  });
});

// ============================================================
// 25b. Catalog.attributes (Issue 12)
// ============================================================

describe('Catalog attribute methods', () => {
  const cat = api.catalog(minimalCatalog);

  test('attributes getter returns attributes array', () => {
    expect(cat.attributes).toHaveLength(5);
    expect(cat.attributes[0]).toHaveProperty('code');
    expect(cat.attributes[0]).toHaveProperty('name');
  });

  test('findAttribute returns matching attribute', () => {
    const attr = cat.findAttribute('WI');
    expect(attr).toBeDefined();
    expect(attr.code).toBe('WI');
    expect(attr.name).toBe('Writing Intensive');
  });

  test('findAttribute returns null for unknown code', () => {
    expect(cat.findAttribute('FAKE')).toBeNull();
  });

  test('findAttribute uses memoized index', () => {
    const a1 = cat.findAttribute('QR');
    const a2 = cat.findAttribute('QR');
    expect(a1).toBe(a2); // same object reference
  });

  test('getAttributes returns sorted copy', () => {
    const sorted = cat.getAttributes();
    expect(sorted).toHaveLength(5);
    // Verify sorted by code
    const codes = sorted.map(a => a.code);
    expect(codes).toEqual(['FA', 'HUM', 'QR', 'SCI', 'WI']);
  });

  test('getAttributes returns a new array each time', () => {
    const a1 = cat.getAttributes();
    const a2 = cat.getAttributes();
    expect(a1).not.toBe(a2);
    expect(a1).toEqual(a2);
  });

  test('attributes defaults to empty array when catalog has none', () => {
    const cat2 = api.catalog({
      institution: 'test',
      ay: '2025-2026',
      courses: [{ id: 1, subject: 'X', number: '1', title: 'X', creditsMin: 1, creditsMax: 1 }],
    });
    expect(cat2.attributes).toEqual([]);
    expect(cat2.getAttributes()).toEqual([]);
    expect(cat2.findAttribute('QR')).toBeNull();
  });
});

// ============================================================
// 25c. Attribute name resolution in renderers (Issue 12)
// ============================================================

describe('Attribute name resolution in renderers', () => {
  test('toOutline resolves attribute codes to display names', () => {
    const req = api.parse('courses where attribute = "WI"');
    const outline = req.toOutline(minimalCatalog);
    expect(outline).toContain('Writing Intensive');
  });

  test('toHTML resolves attribute codes to display names', () => {
    const req = api.parse('courses where attribute = "WI"');
    const html = req.toHTML(minimalCatalog);
    expect(html).toContain('Writing Intensive');
  });

  test('toOutline falls back to raw code when no attributes registry', () => {
    const plainCatalog = {
      institution: 'test',
      ay: '2025-2026',
      courses: [{ id: 1, subject: 'X', number: '1', title: 'X', creditsMin: 1, creditsMax: 1 }],
    };
    const req = api.parse('courses where attribute = "WI"');
    const outline = req.toOutline(plainCatalog);
    expect(outline).toContain('"WI"');
    expect(outline).not.toContain('Writing Intensive');
  });

  test('toHTML falls back to raw code when no attributes registry', () => {
    const plainCatalog = {
      institution: 'test',
      ay: '2025-2026',
      courses: [{ id: 1, subject: 'X', number: '1', title: 'X', creditsMin: 1, creditsMax: 1 }],
    };
    const req = api.parse('courses where attribute = "WI"');
    const html = req.toHTML(plainCatalog);
    expect(html).toContain('&quot;WI&quot;');
    expect(html).not.toContain('Writing Intensive');
  });

  test('toOutline resolves attribute in post-constraint filters', () => {
    const req = api.parse('at least 2 of (MATH 151, CMPS 130, CMPS 230) where at least 1 match (attribute = "QR")');
    const outline = req.toOutline(minimalCatalog);
    expect(outline).toContain('Quantitative Reasoning');
  });

  test('toDescription does not resolve attributes (no catalog param)', () => {
    const req = api.parse('courses where attribute = "WI"');
    const desc = req.description;
    expect(desc).toContain('"WI"');
  });
});

// ============================================================
// 26. calculateGPA entity wrapping (Issue 8)
// ============================================================

describe('calculateGPA entity wrapping', () => {
  test('accepts Transcript and Catalog entities', () => {
    const cat = api.catalog(minimalCatalog);
    const tx = api.transcript({ courses: [
      { subject: 'MATH', number: '151', grade: 'A', credits: 4 },
      { subject: 'CMPS', number: '130', grade: 'B', credits: 3 },
    ] });
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

  test('accepts array of TranscriptCourse instances', () => {
    const entries = [
      new api.TranscriptCourse({ subject: 'MATH', number: '151', grade: 'A', credits: 4 }),
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
    const tx = api.transcript({ courses: [], waivers: [w] });
    const result = req.audit(minimalCatalog, tx);
    expect(result.status).toBe(api.AuditStatus.WAIVED);
  });

  test('Requirement.audit with substitution returns substituted status', () => {
    const req = api.parse('MATH 151');
    const s = api.substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'CMPS', number: '130' },
      reason: 'approved',
    });
    const tx = api.transcript({
      courses: [{ subject: 'CMPS', number: '130', grade: 'A', credits: 3, status: 'completed' }],
      substitutions: [s],
    });
    const result = req.audit(minimalCatalog, tx);
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
    const tx = api.transcript({ courses: [], waivers: [w, unusedW] });
    const result = req.audit(minimalCatalog, tx);
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
    const tx = api.transcript({ courses: completeTx, waivers: [unusedW] });
    const result = req.audit(minimalCatalog, tx);
    const unusedWarnings = result.warnings.filter(w => w.type === 'unused-exception');
    expect(unusedWarnings).toHaveLength(1);
    expect(unusedWarnings[0].message).toContain('ENGL 101');
  });

  test('audit without exceptions has no exceptions property', () => {
    const req = api.parse('MATH 151');
    const result = req.audit(minimalCatalog, api.transcript({ courses: completeTx }));
    expect(result.exceptions).toBeNull();
  });

  test('score waiver through public API', () => {
    const req = api.parse('score SAT_MATH >= 580');
    const w = api.waiver({ score: 'SAT_MATH', reason: 'Documented accommodation' });
    const tx = api.transcript({ courses: [], waivers: [w] });
    const result = req.audit(minimalCatalog, tx);
    expect(result.status).toBe(api.AuditStatus.WAIVED);
    expect(result.exceptions.applied).toHaveLength(1);
  });

  test('label waiver through public API', () => {
    const req = api.parse('"CS Core": all of (CMPS 130, CMPS 148)');
    const w = api.waiver({ label: 'CS Core', reason: 'Transfer equivalency' });
    const tx = api.transcript({ courses: [], waivers: [w] });
    const result = req.audit(minimalCatalog, tx);
    expect(result.status).toBe(api.AuditStatus.WAIVED);
    expect(result.exceptions.applied).toHaveLength(1);
  });

  test('label waiver targeting non-existent label is unused', () => {
    const req = api.parse('"CS Core": all of (CMPS 130, CMPS 148)');
    const w = api.waiver({ label: 'NonExistent', reason: 'Should not match' });
    const tx = api.transcript({ courses: [], waivers: [w] });
    const result = req.audit(minimalCatalog, tx);
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
    const tx = api.transcript({
      courses: [{ subject: 'CMPS', number: '130', grade: 'A', credits: 3, status: 'completed' }],
      waivers: [w],
    });
    const result = api.auditMulti(minimalCatalog, tx, {
      trees: { major: majorReq, minor: minorReq },
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
    const result = req.audit(minimalCatalog, api.transcript({ courses: completeTx }));
    // Labels survive through audit on resolved variable-ref results
    const tree = result.results;
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
    const result = req.audit(minimalCatalog, api.transcript({ courses: completeTx }));
    expect(result.results.label).toBe('Excluded');
  });
});

// ============================================================
// 30. Transcript duplicatePolicy
// ============================================================

describe('Transcript duplicatePolicy', () => {
  test('duplicatePolicy getter returns null by default', () => {
    const tx = api.transcript({ courses: [{ subject: 'MATH', number: '151', grade: 'A', credits: 4 }] });
    expect(tx.duplicatePolicy).toBeNull();
  });

  test('duplicatePolicy getter returns set policy', () => {
    const tx = api.transcript({
      courses: [{ subject: 'MATH', number: '151', grade: 'A', credits: 4 }],
      duplicatePolicy: 'best-grade',
    });
    expect(tx.duplicatePolicy).toBe('best-grade');
  });

  test('duplicatePolicy preserved through immutable mutations', () => {
    const tx = api.transcript({
      courses: [{ subject: 'MATH', number: '151', grade: 'A', credits: 4 }],
      duplicatePolicy: 'first',
    });
    const tx2 = tx.addCourse({ subject: 'CMPS', number: '130', grade: 'B', credits: 3 });
    expect(tx2.duplicatePolicy).toBe('first');
    const tx3 = tx2.removeCourse('CMPS', '130');
    expect(tx3.duplicatePolicy).toBe('first');
  });

  test('best-grade policy selects higher grade during audit', () => {
    const req = api.parse('MATH 101');
    const tx = api.transcript({
      courses: [
        { subject: 'MATH', number: '101', grade: 'D', credits: 3, term: 'Fall 2023', status: 'completed' },
        { subject: 'MATH', number: '101', grade: 'A', credits: 3, term: 'Spring 2024', status: 'completed' },
        { subject: 'MATH', number: '101', grade: 'C', credits: 3, term: 'Fall 2024', status: 'completed' },
      ],
      duplicatePolicy: 'best-grade',
    });
    const result = req.audit(minimalCatalog, tx);
    expect(result.status).toBe('met');
    // The A grade should be selected
    expect(result.results.satisfiedBy.grade).toBe('A');
  });

  test('latest policy uses last entry during audit (default)', () => {
    const req = api.parse('MATH 101');
    const tx = api.transcript({
      courses: [
        { subject: 'MATH', number: '101', grade: 'A', credits: 3, term: 'Fall 2023', status: 'completed' },
        { subject: 'MATH', number: '101', grade: 'C', credits: 3, term: 'Spring 2024', status: 'completed' },
      ],
    });
    const result = req.audit(minimalCatalog, tx);
    expect(result.status).toBe('met');
    expect(result.results.satisfiedBy.grade).toBe('C'); // last wins
  });

  test('first policy uses first entry during audit', () => {
    const req = api.parse('MATH 101');
    const tx = api.transcript({
      courses: [
        { subject: 'MATH', number: '101', grade: 'B', credits: 3, term: 'Fall 2023', status: 'completed' },
        { subject: 'MATH', number: '101', grade: 'A', credits: 3, term: 'Spring 2024', status: 'completed' },
      ],
      duplicatePolicy: 'first',
    });
    const result = req.audit(minimalCatalog, tx);
    expect(result.status).toBe('met');
    expect(result.results.satisfiedBy.grade).toBe('B'); // first wins
  });
});

// ============================================================
// External IDs on SDK entities (#13)
// ============================================================

describe('External IDs on entities', () => {
  // -- TranscriptCourse --

  test('TranscriptCourse.id returns id when provided', () => {
    const tc = new api.TranscriptCourse({ id: 'tc-001', subject: 'MATH', number: '151', grade: 'A', credits: 4 });
    expect(tc.id).toBe('tc-001');
  });

  test('TranscriptCourse.id returns null when not provided', () => {
    const tc = new api.TranscriptCourse({ subject: 'MATH', number: '151' });
    expect(tc.id).toBeNull();
  });

  test('TranscriptCourse.id round-trips through toJSON', () => {
    const tc = new api.TranscriptCourse({ id: 'tc-001', subject: 'MATH', number: '151', grade: 'A', credits: 4 });
    const json = tc.toJSON();
    expect(json.id).toBe('tc-001');
    const tc2 = new api.TranscriptCourse(json);
    expect(tc2.id).toBe('tc-001');
  });

  // -- Degree --

  test('Degree.id returns id when provided', () => {
    const d = api.degree({ id: 'deg-001', code: 'BS', type: 'B.S.', level: 'undergraduate' });
    expect(d.id).toBe('deg-001');
  });

  test('Degree.id returns null when not provided', () => {
    const d = api.degree({ code: 'BS', type: 'B.S.', level: 'undergraduate' });
    expect(d.id).toBeNull();
  });

  test('Degree.id round-trips through toJSON', () => {
    const d = api.degree({ id: 'deg-001', code: 'BS', type: 'B.S.', level: 'undergraduate', name: 'Bachelor of Science' });
    const json = d.toJSON();
    expect(json.id).toBe('deg-001');
    const d2 = api.degree(json);
    expect(d2.id).toBe('deg-001');
  });

  // -- Waiver --

  test('Waiver.id returns id when provided', () => {
    const w = api.waiver({ id: 'w-001', course: { subject: 'CMPS', number: '310' }, reason: 'Transfer' });
    expect(w.id).toBe('w-001');
  });

  test('Waiver.id returns null when not provided', () => {
    const w = api.waiver({ course: { subject: 'CMPS', number: '310' }, reason: 'Transfer' });
    expect(w.id).toBeNull();
  });

  test('Waiver.id round-trips through toJSON', () => {
    const w = api.waiver({ id: 'w-001', course: { subject: 'CMPS', number: '310' }, reason: 'Transfer' });
    const json = w.toJSON();
    expect(json.id).toBe('w-001');
  });

  test('Waiver toJSON omits id when null', () => {
    const w = api.waiver({ course: { subject: 'CMPS', number: '310' }, reason: 'Transfer' });
    const json = w.toJSON();
    expect(json).not.toHaveProperty('id');
  });

  test('removeWaiver by id', () => {
    const tx = api.transcript({ courses: [] });
    const w = api.waiver({ id: 'w-001', course: { subject: 'MATH', number: '151' }, reason: 'Transfer' });
    const tx2 = tx.addWaiver(w);
    expect(tx2.waivers).toHaveLength(1);
    const tx3 = tx2.removeWaiver('w-001');
    expect(tx3.waivers).toHaveLength(0);
  });

  // -- Substitution --

  test('Substitution.id returns id when provided', () => {
    const s = api.substitution({
      id: 's-001',
      original: { subject: 'MATH', number: '250' },
      replacement: { subject: 'MATH', number: '241' },
      reason: 'Transfer',
    });
    expect(s.id).toBe('s-001');
  });

  test('Substitution.id returns null when not provided', () => {
    const s = api.substitution({
      original: { subject: 'MATH', number: '250' },
      replacement: { subject: 'MATH', number: '241' },
      reason: 'Transfer',
    });
    expect(s.id).toBeNull();
  });

  test('Substitution.id round-trips through toJSON', () => {
    const s = api.substitution({
      id: 's-001',
      original: { subject: 'MATH', number: '250' },
      replacement: { subject: 'MATH', number: '241' },
      reason: 'Transfer',
    });
    const json = s.toJSON();
    expect(json.id).toBe('s-001');
  });

  test('Substitution toJSON omits id when null', () => {
    const s = api.substitution({
      original: { subject: 'MATH', number: '250' },
      replacement: { subject: 'MATH', number: '241' },
      reason: 'Transfer',
    });
    const json = s.toJSON();
    expect(json).not.toHaveProperty('id');
  });

  test('removeSubstitution by id', () => {
    const tx = api.transcript({ courses: [] });
    const s = api.substitution({
      id: 's-001',
      original: { subject: 'MATH', number: '250' },
      replacement: { subject: 'MATH', number: '241' },
      reason: 'Transfer',
    });
    const tx2 = tx.addSubstitution(s);
    expect(tx2.substitutions).toHaveLength(1);
    const tx3 = tx2.removeSubstitution('s-001');
    expect(tx3.substitutions).toHaveLength(0);
  });

  // -- Existing removal still works --

  test('removeWaiver by domain fields still works with id present', () => {
    const tx = api.transcript({ courses: [] });
    const w = api.waiver({ id: 'w-001', course: { subject: 'MATH', number: '151' }, reason: 'Transfer' });
    const tx2 = tx.addWaiver(w);
    const tx3 = tx2.removeWaiver({ subject: 'MATH', number: '151' });
    expect(tx3.waivers).toHaveLength(0);
  });

  test('removeSubstitution by domain fields still works with id present', () => {
    const tx = api.transcript({ courses: [] });
    const s = api.substitution({
      id: 's-001',
      original: { subject: 'MATH', number: '250' },
      replacement: { subject: 'MATH', number: '241' },
      reason: 'Transfer',
    });
    const tx2 = tx.addSubstitution(s);
    const tx3 = tx2.removeSubstitution({ subject: 'MATH', number: '250' });
    expect(tx3.substitutions).toHaveLength(0);
  });
});

// ============================================================
// Course entity
// ============================================================

describe('Course entity', () => {
  test('course() factory returns Course instance', () => {
    const c = api.course({ subject: 'MATH', number: '151' });
    expect(c).toBeInstanceOf(api.Course);
  });

  test('requires subject and number', () => {
    expect(() => api.course({})).toThrow('Course requires subject and number');
    expect(() => api.course({ subject: 'MATH' })).toThrow('Course requires subject and number');
    expect(() => api.course({ number: '151' })).toThrow('Course requires subject and number');
  });

  test('getters expose all fields', () => {
    const c = api.course({
      id: 42,
      subject: 'CMPS',
      number: '310',
      title: 'Algorithms',
      creditsMin: 3,
      creditsMax: 3,
      attributes: ['WI'],
      crossListGroup: 'CMPS-MATH-310',
    });
    expect(c.id).toBe(42);
    expect(c.subject).toBe('CMPS');
    expect(c.number).toBe('310');
    expect(c.title).toBe('Algorithms');
    expect(c.creditsMin).toBe(3);
    expect(c.creditsMax).toBe(3);
    expect(c.attributes).toEqual(['WI']);
    expect(c.crossListGroup).toBe('CMPS-MATH-310');
    expect(c.prerequisites).toBeNull();
    expect(c.corequisites).toBeNull();
  });

  test('defaults: id null, title null, credits null, attributes [], prereqs/coreqs null', () => {
    const c = api.course({ subject: 'MATH', number: '101' });
    expect(c.id).toBeNull();
    expect(c.title).toBeNull();
    expect(c.creditsMin).toBeNull();
    expect(c.creditsMax).toBeNull();
    expect(c.attributes).toEqual([]);
    expect(c.crossListGroup).toBeNull();
    expect(c.prerequisites).toBeNull();
    expect(c.corequisites).toBeNull();
  });

  test('toJSON() returns plain object', () => {
    const c = api.course({ subject: 'MATH', number: '151', title: 'Calculus I' });
    const json = c.toJSON();
    expect(json.subject).toBe('MATH');
    expect(json.number).toBe('151');
    expect(json).toEqual({ subject: 'MATH', number: '151', title: 'Calculus I', prerequisites: null, corequisites: null, attributes: [] });
  });

  test('data is frozen', () => {
    const c = api.course({ subject: 'MATH', number: '151' });
    expect(Object.isFrozen(c.data)).toBe(true);
  });

  // Prerequisite normalization
  test('prerequisites: string is auto-parsed to AST', () => {
    const c = api.course({ subject: 'CMPS', number: '310', prerequisites: 'CMPS 230' });
    expect(c.prerequisites).toBeDefined();
    expect(c.prerequisites.type).toBe('course');
    expect(c.prerequisites.subject).toBe('CMPS');
    expect(c.prerequisites.number).toBe('230');
  });

  test('prerequisites: Requirement instance is unwrapped to AST', () => {
    const req = api.parse('all of (CMPS 130, CMPS 230)');
    const c = api.course({ subject: 'CMPS', number: '310', prerequisites: req });
    expect(c.prerequisites.type).toBe('all-of');
    expect(c.prerequisites.items).toHaveLength(2);
  });

  test('prerequisites: raw AST object passes through', () => {
    const ast = { type: 'course', subject: 'CMPS', number: '230' };
    const c = api.course({ subject: 'CMPS', number: '310', prerequisites: ast });
    expect(c.prerequisites).toEqual(ast);
  });

  test('prerequisites: null/undefined normalizes to null', () => {
    expect(api.course({ subject: 'A', number: '1', prerequisites: null }).prerequisites).toBeNull();
    expect(api.course({ subject: 'A', number: '1', prerequisites: undefined }).prerequisites).toBeNull();
    expect(api.course({ subject: 'A', number: '1' }).prerequisites).toBeNull();
  });

  test('corequisites: string is auto-parsed to AST', () => {
    const c = api.course({ subject: 'CMPS', number: '492', corequisites: 'CMPS 360' });
    expect(c.corequisites.type).toBe('course');
    expect(c.corequisites.subject).toBe('CMPS');
    expect(c.corequisites.number).toBe('360');
  });

  test('corequisites: Requirement instance is unwrapped to AST', () => {
    const req = api.parse('CMPS 360');
    const c = api.course({ subject: 'CMPS', number: '492', corequisites: req });
    expect(c.corequisites.type).toBe('course');
  });
});

// ============================================================
// Program entity
// ============================================================

describe('Program entity', () => {
  test('program() factory returns Program instance', () => {
    const p = api.program({ code: 'CMPS', type: 'major', level: 'undergraduate' });
    expect(p).toBeInstanceOf(api.Program);
  });

  test('requires code, type, and level', () => {
    expect(() => api.program({})).toThrow('Program requires a code');
    expect(() => api.program({ code: 'CMPS' })).toThrow('Program requires a type');
    expect(() => api.program({ code: 'CMPS', type: 'major' })).toThrow('Program requires a level');
  });

  test('getters expose all fields', () => {
    const p = api.program({
      id: 1, code: 'CMPS', name: 'Computer Science', type: 'major', level: 'undergraduate',
    });
    expect(p.id).toBe(1);
    expect(p.code).toBe('CMPS');
    expect(p.name).toBe('Computer Science');
    expect(p.type).toBe('major');
    expect(p.level).toBe('undergraduate');
    expect(p.requirements).toBeUndefined();
  });

  test('toJSON() returns plain object', () => {
    const p = api.program({ code: 'CMPS', type: 'major', level: 'undergraduate' });
    const json = p.toJSON();
    expect(json).toEqual({ code: 'CMPS', type: 'major', level: 'undergraduate' });
  });

  test('data is frozen', () => {
    const p = api.program({ code: 'CMPS', type: 'major', level: 'undergraduate' });
    expect(Object.isFrozen(p.data)).toBe(true);
  });
});

// ============================================================
// Attribute entity
// ============================================================

describe('Attribute entity', () => {
  test('attribute() factory returns Attribute instance', () => {
    const a = api.attribute({ code: 'WI' });
    expect(a).toBeInstanceOf(api.Attribute);
  });

  test('requires code', () => {
    expect(() => api.attribute({})).toThrow('Attribute requires a code');
  });

  test('getters expose all fields', () => {
    const a = api.attribute({ id: 5, code: 'WI', name: 'Writing Intensive' });
    expect(a.id).toBe(5);
    expect(a.code).toBe('WI');
    expect(a.name).toBe('Writing Intensive');
  });

  test('defaults: id null, name null', () => {
    const a = api.attribute({ code: 'QR' });
    expect(a.id).toBeNull();
    expect(a.name).toBeNull();
  });

  test('toJSON() returns plain object', () => {
    const a = api.attribute({ code: 'WI', name: 'Writing Intensive' });
    expect(a.toJSON()).toEqual({ code: 'WI', name: 'Writing Intensive' });
  });

  test('data is frozen', () => {
    const a = api.attribute({ code: 'WI' });
    expect(Object.isFrozen(a.data)).toBe(true);
  });
});

// ============================================================
// DeclaredProgram entity
// ============================================================

describe('DeclaredProgram entity', () => {
  test('declaredProgram() factory returns DeclaredProgram instance', () => {
    const dp = api.declaredProgram({ code: 'CMPS', type: 'major', level: 'undergraduate' });
    expect(dp).toBeInstanceOf(api.DeclaredProgram);
  });

  test('requires code and type', () => {
    expect(() => api.declaredProgram({})).toThrow('DeclaredProgram requires a code');
    expect(() => api.declaredProgram({ code: 'CMPS' })).toThrow('DeclaredProgram requires a type');
  });

  test('validates type against ProgramType values', () => {
    expect(() => api.declaredProgram({ code: 'CMPS', type: 'invalid' })).toThrow('DeclaredProgram type must be one of');
    // Valid types should not throw
    expect(() => api.declaredProgram({ code: 'CMPS', type: 'major' })).not.toThrow();
    expect(() => api.declaredProgram({ code: 'CMPS', type: 'minor' })).not.toThrow();
    expect(() => api.declaredProgram({ code: 'CMPS', type: 'certificate' })).not.toThrow();
  });

  test('validates level against ProgramLevel values when provided', () => {
    expect(() => api.declaredProgram({ code: 'CMPS', type: 'major', level: 'invalid' })).toThrow('DeclaredProgram level must be one of');
    // Valid levels should not throw
    expect(() => api.declaredProgram({ code: 'CMPS', type: 'major', level: 'undergraduate' })).not.toThrow();
    expect(() => api.declaredProgram({ code: 'CMPS', type: 'major', level: 'graduate' })).not.toThrow();
  });

  test('level is optional', () => {
    const dp = api.declaredProgram({ code: 'CMPS', type: 'major' });
    expect(dp.level).toBeNull();
  });

  test('getters expose all fields', () => {
    const dp = api.declaredProgram({
      id: 'd-1', code: 'CMPS', type: 'major', level: 'undergraduate', role: 'primary',
    });
    expect(dp.id).toBe('d-1');
    expect(dp.code).toBe('CMPS');
    expect(dp.type).toBe('major');
    expect(dp.level).toBe('undergraduate');
    expect(dp.role).toBe('primary');
  });

  test('defaults: id null, role null', () => {
    const dp = api.declaredProgram({ code: 'CMPS', type: 'major' });
    expect(dp.id).toBeNull();
    expect(dp.role).toBeNull();
  });

  test('toJSON() returns plain object', () => {
    const dp = api.declaredProgram({ code: 'CMPS', type: 'major', level: 'undergraduate', role: 'primary' });
    expect(dp.toJSON()).toEqual({ code: 'CMPS', type: 'major', level: 'undergraduate', role: 'primary' });
  });

  test('data is frozen', () => {
    const dp = api.declaredProgram({ code: 'CMPS', type: 'major' });
    expect(Object.isFrozen(dp.data)).toBe(true);
  });
});

// ============================================================
// Transcript auto-wrapping of DeclaredProgram
// ============================================================

describe('Transcript auto-wrapping of DeclaredProgram', () => {
  test('plain declared programs are wrapped into DeclaredProgram instances', () => {
    const tx = api.transcript({
      courses: [],
      declaredPrograms: [
        { code: 'CMPS', type: 'major', level: 'undergraduate', role: 'primary' },
      ],
    });
    expect(tx.declaredPrograms[0]).toBeInstanceOf(api.DeclaredProgram);
    expect(tx.declaredPrograms[0].code).toBe('CMPS');
  });

  test('DeclaredProgram instances pass through unchanged', () => {
    const dp = api.declaredProgram({ code: 'MATH', type: 'minor', level: 'undergraduate' });
    const tx = api.transcript({ courses: [], declaredPrograms: [dp] });
    expect(tx.declaredPrograms[0]).toBe(dp);
  });

  test('declareProgram with plain object auto-wraps', () => {
    const tx = api.transcript({ courses: [] });
    const tx2 = tx.declareProgram({ code: 'CMPS', type: 'major', level: 'undergraduate' });
    expect(tx2.declaredPrograms[0]).toBeInstanceOf(api.DeclaredProgram);
  });

  test('declared programs work correctly in audits', () => {
    const cat = api.catalog(minimalCatalog);
    const req = api.parse('all of (CMPS 130, CMPS 230)');
    const enriched = cat.withPrograms({ 'CMPS': req });
    const mainReq = api.parse('program "CMPS"');
    const tx = api.transcript({
      courses: [
        { subject: 'CMPS', number: '130', grade: 'A', credits: 3 },
        { subject: 'CMPS', number: '230', grade: 'B', credits: 3 },
      ],
      declaredPrograms: [{ code: 'CMPS', type: 'major', level: 'undergraduate' }],
    });
    const result = mainReq.audit(enriched, tx);
    expect(result.status).toBe('met');
  });
});

// ============================================================
// Catalog auto-wrapping
// ============================================================

describe('Catalog auto-wrapping', () => {
  test('catalog.courses returns Course instances', () => {
    const cat = api.catalog(minimalCatalog);
    for (const c of cat.courses) {
      expect(c).toBeInstanceOf(api.Course);
    }
  });

  test('catalog.programs returns Program instances', () => {
    const cat = api.catalog(minimalCatalog);
    for (const p of cat.programs) {
      expect(p).toBeInstanceOf(api.Program);
    }
  });

  test('catalog.attributes returns Attribute instances', () => {
    const cat = api.catalog(minimalCatalog);
    for (const a of cat.attributes) {
      expect(a).toBeInstanceOf(api.Attribute);
    }
  });

  test('findCourse() returns Course instance', () => {
    const cat = api.catalog(minimalCatalog);
    const c = cat.findCourse('MATH', '151');
    expect(c).toBeInstanceOf(api.Course);
    expect(c.subject).toBe('MATH');
    expect(c.number).toBe('151');
    expect(c.title).toBe('Calculus I');
  });

  test('findProgram() returns Program instance', () => {
    const cat = api.catalog(minimalCatalog);
    const p = cat.findProgram('CMPS');
    expect(p).toBeInstanceOf(api.Program);
    expect(p.code).toBe('CMPS');
    expect(p.type).toBe('major');
  });

  test('findAttribute() returns Attribute instance', () => {
    const cat = api.catalog(minimalCatalog);
    const a = cat.findAttribute('WI');
    expect(a).toBeInstanceOf(api.Attribute);
    expect(a.code).toBe('WI');
    expect(a.name).toBe('Writing Intensive');
  });

  test('catalogs built with plain objects still work for audits', () => {
    const cat = api.catalog(minimalCatalog);
    const req = api.parse('all of (MATH 151, CMPS 130)');
    const tx = api.transcript({
      courses: [
        { subject: 'MATH', number: '151', grade: 'A', credits: 4 },
        { subject: 'CMPS', number: '130', grade: 'B', credits: 3 },
      ],
    });
    const result = req.audit(cat, tx);
    expect(result.status).toBe('met');
  });

  test('catalogs built with Course instances work', () => {
    const c1 = api.course({ subject: 'MATH', number: '151', creditsMin: 4, creditsMax: 4 });
    const c2 = api.course({ subject: 'CMPS', number: '130', creditsMin: 3, creditsMax: 3 });
    const cat = api.catalog({ ay: '2025-2026', courses: [c1, c2] });
    expect(cat.courses).toHaveLength(2);
    expect(cat.findCourse('MATH', '151')).toBeInstanceOf(api.Course);
  });

  test('prerequisite strings auto-parse when building catalog with plain objects', () => {
    const cat = api.catalog({
      ay: '2025-2026',
      courses: [
        { subject: 'MATH', number: '151', creditsMin: 4, creditsMax: 4 },
        { subject: 'MATH', number: '152', creditsMin: 4, creditsMax: 4, prerequisites: 'MATH 151' },
      ],
    });
    const c = cat.findCourse('MATH', '152');
    expect(c.prerequisites).toBeDefined();
    expect(c.prerequisites.type).toBe('course');
    expect(c.prerequisites.subject).toBe('MATH');
    expect(c.prerequisites.number).toBe('151');
  });
});

// ============================================================
// 26. SharedDefinition entity
// ============================================================

describe('SharedDefinition', () => {
  test('sharedDefinition factory is a function', () => {
    expect(typeof api.sharedDefinition).toBe('function');
  });

  test('SharedDefinition class is exported', () => {
    expect(typeof api.SharedDefinition).toBe('function');
  });

  test('constructs from string requirement', () => {
    const v = api.sharedDefinition({ name: 'discrete', requirement: 'any of (MATH 205, MATH 237)' });
    expect(v).toBeInstanceOf(api.SharedDefinition);
    expect(v.name).toBe('discrete');
    expect(v.requirement).toBeInstanceOf(api.Requirement);
    expect(v.ast).toBeDefined();
    expect(v.ast.type).toBe('any-of');
  });

  test('constructs from Requirement instance', () => {
    const req = api.parse('all of (CMPS 130, CMPS 230)');
    const v = api.sharedDefinition({ name: 'cs_core', requirement: req });
    expect(v.name).toBe('cs_core');
    expect(v.requirement).toBe(req);
    expect(v.ast.type).toBe('all-of');
  });

  test('constructs from raw AST', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const v = api.sharedDefinition({ name: 'calc', requirement: ast });
    expect(v.name).toBe('calc');
    expect(v.requirement).toBeInstanceOf(api.Requirement);
    expect(v.ast.type).toBe('course');
  });

  test('missing name throws', () => {
    expect(() => api.sharedDefinition({ requirement: 'MATH 151' })).toThrow('name');
  });

  test('missing requirement throws', () => {
    expect(() => api.sharedDefinition({ name: 'x' })).toThrow('requirement');
  });

  test('data accessor returns frozen object', () => {
    const v = api.sharedDefinition({ name: 'x', requirement: 'MATH 151' });
    expect(Object.isFrozen(v.data)).toBe(true);
  });

  test('toJSON returns name and ast', () => {
    const v = api.sharedDefinition({ name: 'discrete', requirement: 'any of (MATH 205, MATH 237)' });
    const json = v.toJSON();
    expect(json.name).toBe('discrete');
    expect(json.ast).toBeDefined();
    expect(json.ast.type).toBe('any-of');
  });
});

// ============================================================
// 27. sharedDefinitions support
// ============================================================

describe('sharedDefinitions', () => {
  const cat = api.catalog(minimalCatalog);

  test('single-tree audit: shared variable resolves in requirement', () => {
    // Define $electives as a shared variable
    const shared = [api.sharedDefinition({ name: 'electives', requirement: 'any of (CMPS 130, CMPS 230)' })];
    const req = api.parse('all of (MATH 151, $electives)');
    const tx = api.transcript({
      courses: [
        { subject: 'MATH', number: '151', grade: 'A', credits: 4 },
        { subject: 'CMPS', number: '130', grade: 'B', credits: 3 },
      ],
    });
    const result = req.audit(cat, tx, { sharedDefinitions: shared });
    expect(result.status).toBe(api.AuditStatus.MET);
  });

  test('single-tree audit: missing shared variable does not crash', () => {
    const req = api.parse('all of (MATH 151, $missing)');
    const tx = api.transcript({
      courses: [{ subject: 'MATH', number: '151', grade: 'A', credits: 4 }],
    });
    const result = req.audit(cat, tx);
    // MATH 151 is met but $missing is unresolved → partial-progress, not a crash
    expect(result.status).toBe(api.AuditStatus.IN_PROGRESS);
  });

  test('local variable definition wins over shared', () => {
    // Shared: $x = CMPS 130; Local in req: $x = MATH 151
    const shared = [api.sharedDefinition({ name: 'x', requirement: 'CMPS 130' })];
    const req = api.parse('all of ($x = MATH 151, $x)');
    const tx = api.transcript({
      courses: [{ subject: 'MATH', number: '151', grade: 'A', credits: 4 }],
    });
    const result = req.audit(cat, tx, { sharedDefinitions: shared });
    // Local $x = MATH 151 wins, so completing MATH 151 should satisfy it
    expect(result.status).toBe(api.AuditStatus.MET);
  });

  test('multi-tree audit: sharedDefinitions available to all trees', () => {
    const shared = [api.sharedDefinition({ name: 'calc', requirement: 'MATH 151' })];
    const tree1 = api.parse('all of ($calc, CMPS 130)');
    const tree2 = api.parse('$calc');
    const tx = api.transcript({
      courses: [
        { subject: 'MATH', number: '151', grade: 'A', credits: 4 },
        { subject: 'CMPS', number: '130', grade: 'B', credits: 3 },
      ],
    });
    const multi = api.auditMulti(cat, tx, {
      trees: { PROG1: tree1, PROG2: tree2 },
      sharedDefinitions: shared,
    });
    expect(multi.trees.PROG1.status).toBe(api.AuditStatus.MET);
    expect(multi.trees.PROG2.status).toBe(api.AuditStatus.MET);
  });

  test('resolve: shared variable refs expand with sharedDefinitions', () => {
    const shared = [api.sharedDefinition({ name: 'electives', requirement: 'any of (CMPS 130, CMPS 230)' })];
    const req = api.parse('all of (MATH 151, $electives)');
    const resolved = req.resolve(cat, { sharedDefinitions: shared });
    const allCourses = resolved.allCourses();
    const keys = allCourses.map(c => `${c.subject}:${c.number}`);
    expect(keys).toContain('MATH:151');
    expect(keys).toContain('CMPS:130');
    expect(keys).toContain('CMPS:230');
  });

  test('sharedDefinitions accepts plain Map<string, AST>', () => {
    const shared = new Map([
      ['electives', { type: 'course', subject: 'CMPS', number: '130' }],
    ]);
    const req = api.parse('all of (MATH 151, $electives)');
    const tx = api.transcript({
      courses: [
        { subject: 'MATH', number: '151', grade: 'A', credits: 4 },
        { subject: 'CMPS', number: '130', grade: 'B', credits: 3 },
      ],
    });
    const result = req.audit(cat, tx, { sharedDefinitions: shared });
    expect(result.status).toBe(api.AuditStatus.MET);
  });

  test('sharedDefinitions accepts plain object { name: AST }', () => {
    const shared = {
      electives: { type: 'course', subject: 'CMPS', number: '130' },
    };
    const req = api.parse('all of (MATH 151, $electives)');
    const tx = api.transcript({
      courses: [
        { subject: 'MATH', number: '151', grade: 'A', credits: 4 },
        { subject: 'CMPS', number: '130', grade: 'B', credits: 3 },
      ],
    });
    const result = req.audit(cat, tx, { sharedDefinitions: shared });
    expect(result.status).toBe(api.AuditStatus.MET);
  });
});

// ============================================================
// Extra fields preservation (round-trip)
// ============================================================

describe('Extra fields preservation', () => {
  // -- Waiver extras --

  test('Waiver preserves extra fields through toJSON()', () => {
    const w = api.waiver({
      course: { subject: 'MATH', number: '151' },
      reason: 'AP credit',
      approved_by: 'Dean Smith',
      created_at: '2026-01-15',
    });
    const json = w.toJSON();
    expect(json.approved_by).toBe('Dean Smith');
    expect(json.created_at).toBe('2026-01-15');
    expect(json.reason).toBe('AP credit');
    expect(json.course).toEqual({ subject: 'MATH', number: '151' });
  });

  test('Waiver extras survive Transcript auto-wrap', () => {
    const tx = api.transcript({
      courses: [],
      waivers: [{
        course: { subject: 'MATH', number: '151' },
        reason: 'AP credit',
        approved_by: 'Dean Smith',
      }],
    });
    const json = tx.toJSON();
    expect(json.waivers[0].approved_by).toBe('Dean Smith');
  });

  // -- Substitution extras --

  test('Substitution preserves extra fields through toJSON()', () => {
    const s = api.substitution({
      original: { subject: 'MATH', number: '151' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'Department approval',
      student_id: 'stu-42',
    });
    const json = s.toJSON();
    expect(json.student_id).toBe('stu-42');
    expect(json.reason).toBe('Department approval');
  });

  test('Substitution extras survive Transcript auto-wrap', () => {
    const tx = api.transcript({
      courses: [],
      substitutions: [{
        original: { subject: 'MATH', number: '151' },
        replacement: { subject: 'PHYS', number: '201' },
        reason: 'approved',
        student_id: 'stu-42',
      }],
    });
    const json = tx.toJSON();
    expect(json.substitutions[0].student_id).toBe('stu-42');
  });

  // -- Transcript extras --

  test('Transcript preserves extra fields through toJSON()', () => {
    const tx = api.transcript({
      courses: [{ subject: 'MATH', number: '151', grade: 'A', credits: 4 }],
      student_id: 'stu-99',
      advisor: 'Dr. Jones',
    });
    const json = tx.toJSON();
    expect(json.student_id).toBe('stu-99');
    expect(json.advisor).toBe('Dr. Jones');
    expect(json.courses).toHaveLength(1);
  });

  test('Transcript extras survive immutable mutations', () => {
    const tx = api.transcript({
      courses: [],
      student_id: 'stu-99',
    });
    const tx2 = tx.addCourse({ subject: 'MATH', number: '151', grade: 'A', credits: 4 });
    expect(tx2.toJSON().student_id).toBe('stu-99');
    expect(tx2.courses).toHaveLength(1);

    const tx3 = tx2.addAttainment('JUNIOR_STANDING', true);
    expect(tx3.toJSON().student_id).toBe('stu-99');

    const w = api.waiver({ course: { subject: 'ENGL', number: '101' }, reason: 'Transfer' });
    const tx4 = tx3.addWaiver(w);
    expect(tx4.toJSON().student_id).toBe('stu-99');

    const s = api.substitution({
      original: { subject: 'PHYS', number: '101' },
      replacement: { subject: 'PHYS', number: '201' },
      reason: 'approved',
    });
    const tx5 = tx4.addSubstitution(s);
    expect(tx5.toJSON().student_id).toBe('stu-99');

    const tx6 = tx5.declareProgram({ code: 'CS-BS', type: 'major' });
    expect(tx6.toJSON().student_id).toBe('stu-99');
  });

  test('Transcript.toJSON deep-serializes nested entities', () => {
    const w = api.waiver({
      course: { subject: 'MATH', number: '151' },
      reason: 'AP credit',
      approved_by: 'Dean',
    });
    const s = api.substitution({
      original: { subject: 'ENGL', number: '101' },
      replacement: { subject: 'ENGL', number: '201' },
      reason: 'approved',
      student_id: 'stu-1',
    });
    const tx = api.transcript({
      courses: [{ subject: 'MATH', number: '151', grade: 'A', credits: 4, custom: 'val' }],
      declaredPrograms: [{ code: 'CS-BS', type: 'major', dept: 'CS' }],
      waivers: [w],
      substitutions: [s],
      student_id: 'stu-1',
    });
    const json = tx.toJSON();

    // Transcript extras
    expect(json.student_id).toBe('stu-1');
    // Course extras
    expect(json.courses[0].custom).toBe('val');
    // DeclaredProgram extras
    expect(json.declaredPrograms[0].dept).toBe('CS');
    // Waiver extras
    expect(json.waivers[0].approved_by).toBe('Dean');
    // Substitution extras
    expect(json.substitutions[0].student_id).toBe('stu-1');
  });

  test('JSON.stringify round-trip preserves all extras', () => {
    const tx = api.transcript({
      courses: [{ subject: 'MATH', number: '151', grade: 'A', credits: 4, enrollment_id: 'e1' }],
      waivers: [{
        course: { subject: 'ENGL', number: '101' },
        reason: 'Transfer',
        waiver_id: 'w1',
      }],
      substitutions: [{
        original: { subject: 'PHYS', number: '101' },
        replacement: { subject: 'PHYS', number: '201' },
        reason: 'approved',
        sub_id: 's1',
      }],
      student_id: 'stu-42',
    });

    const roundTripped = JSON.parse(JSON.stringify(tx));
    expect(roundTripped.student_id).toBe('stu-42');
    expect(roundTripped.courses[0].enrollment_id).toBe('e1');
    expect(roundTripped.waivers[0].waiver_id).toBe('w1');
    expect(roundTripped.substitutions[0].sub_id).toBe('s1');

    // Re-hydrate and verify
    const tx2 = api.transcript(roundTripped);
    expect(tx2.toJSON().student_id).toBe('stu-42');
    expect(tx2.courses[0].toJSON().enrollment_id).toBe('e1');
  });
});

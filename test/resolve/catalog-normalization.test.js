'use strict';

const { resolve, normalizeCatalog } = require('../../src/resolve');

describe('catalog normalization', () => {
  const baseCatalog = {
    institution: 'test',
    ay: '2025-2026',
    courses: [],
    programs: [],
    attainments: [],
    gradeConfig: { scale: [], passFail: [], withdrawal: [], incomplete: [] },
  };

  describe('normalizeCatalog()', () => {
    it('defaults missing attributes to empty array', () => {
      const catalog = {
        ...baseCatalog,
        courses: [
          { id: 1, subject: 'MATH', number: '101', title: 'Algebra', creditsMin: 3, creditsMax: 3 },
        ],
      };
      const norm = normalizeCatalog(catalog);
      expect(norm.courses[0].attributes).toEqual([]);
    });

    it('preserves existing attributes', () => {
      const catalog = {
        ...baseCatalog,
        courses: [
          { id: 1, subject: 'MATH', number: '101', title: 'Algebra', creditsMin: 3, creditsMax: 3, attributes: ['QR', 'SCI'] },
        ],
      };
      const norm = normalizeCatalog(catalog);
      expect(norm.courses[0].attributes).toEqual(['QR', 'SCI']);
    });

    it('defaults missing crossListGroup to undefined', () => {
      const catalog = {
        ...baseCatalog,
        courses: [
          { id: 1, subject: 'MATH', number: '101', title: 'Algebra', creditsMin: 3, creditsMax: 3 },
        ],
      };
      const norm = normalizeCatalog(catalog);
      expect(norm.courses[0].crossListGroup).toBeUndefined();
    });

    it('preserves existing crossListGroup', () => {
      const catalog = {
        ...baseCatalog,
        courses: [
          { id: 1, subject: 'CSE', number: '340', title: 'Algorithms', creditsMin: 4, creditsMax: 4, crossListGroup: 'cl-cse340' },
        ],
      };
      const norm = normalizeCatalog(catalog);
      expect(norm.courses[0].crossListGroup).toBe('cl-cse340');
    });

    it('defaults missing prerequisites to null', () => {
      const catalog = {
        ...baseCatalog,
        courses: [
          { id: 1, subject: 'MATH', number: '101', title: 'Algebra', creditsMin: 3, creditsMax: 3 },
        ],
      };
      const norm = normalizeCatalog(catalog);
      expect(norm.courses[0].prerequisites).toBeNull();
    });

    it('preserves existing prerequisites', () => {
      const prereq = { type: 'course', subject: 'MATH', number: '101' };
      const catalog = {
        ...baseCatalog,
        courses: [
          { id: 1, subject: 'MATH', number: '151', title: 'Calc I', creditsMin: 4, creditsMax: 4, prerequisites: prereq },
        ],
      };
      const norm = normalizeCatalog(catalog);
      expect(norm.courses[0].prerequisites).toEqual(prereq);
    });

    it('defaults missing corequisites to null', () => {
      const catalog = {
        ...baseCatalog,
        courses: [
          { id: 1, subject: 'MATH', number: '101', title: 'Algebra', creditsMin: 3, creditsMax: 3 },
        ],
      };
      const norm = normalizeCatalog(catalog);
      expect(norm.courses[0].corequisites).toBeNull();
    });

    it('preserves existing corequisites', () => {
      const coreq = { type: 'course', subject: 'CMPS', number: '360' };
      const catalog = {
        ...baseCatalog,
        courses: [
          { id: 1, subject: 'CMPS', number: '492', title: 'Senior Project II', creditsMin: 3, creditsMax: 3, corequisites: coreq },
        ],
      };
      const norm = normalizeCatalog(catalog);
      expect(norm.courses[0].corequisites).toEqual(coreq);
    });

    it('normalizes all courses in one pass', () => {
      const catalog = {
        ...baseCatalog,
        courses: [
          { id: 1, subject: 'MATH', number: '101', title: 'A', creditsMin: 3, creditsMax: 3 },
          { id: 2, subject: 'MATH', number: '151', title: 'B', creditsMin: 4, creditsMax: 4, attributes: ['QR'] },
          { id: 3, subject: 'CSE', number: '340', title: 'C', creditsMin: 4, creditsMax: 4, crossListGroup: 'cl-1', prerequisites: { type: 'course', subject: 'CSE', number: '230' } },
        ],
      };
      const norm = normalizeCatalog(catalog);
      expect(norm.courses).toHaveLength(3);

      // Course 1: all defaults
      expect(norm.courses[0].attributes).toEqual([]);
      expect(norm.courses[0].crossListGroup).toBeUndefined();
      expect(norm.courses[0].prerequisites).toBeNull();
      expect(norm.courses[0].corequisites).toBeNull();

      // Course 2: has attributes
      expect(norm.courses[1].attributes).toEqual(['QR']);
      expect(norm.courses[1].crossListGroup).toBeUndefined();

      // Course 3: has crossListGroup and prerequisites
      expect(norm.courses[2].crossListGroup).toBe('cl-1');
      expect(norm.courses[2].prerequisites).toEqual({ type: 'course', subject: 'CSE', number: '230' });
      expect(norm.courses[2].corequisites).toBeNull();
    });

    it('preserves non-course catalog fields', () => {
      const catalog = {
        ...baseCatalog,
        institution: 'lehigh',
        ay: '2025-2026',
        programs: [{ id: 1, code: 'CS', name: 'Computer Science', type: 'major', level: 'undergraduate' }],
        courses: [
          { id: 1, subject: 'MATH', number: '101', title: 'Algebra', creditsMin: 3, creditsMax: 3 },
        ],
      };
      const norm = normalizeCatalog(catalog);
      expect(norm.institution).toBe('lehigh');
      expect(norm.ay).toBe('2025-2026');
      expect(norm.programs).toEqual(catalog.programs);
    });

    it('does not mutate the original catalog', () => {
      const original = {
        ...baseCatalog,
        courses: [
          { id: 1, subject: 'MATH', number: '101', title: 'Algebra', creditsMin: 3, creditsMax: 3 },
        ],
      };
      normalizeCatalog(original);
      expect(original.courses[0].attributes).toBeUndefined();
      expect(original.courses[0].prerequisites).toBeUndefined();
    });
  });

  describe('resolve() with catalogs missing optional fields', () => {
    it('resolves courses from a catalog with no attributes', () => {
      const catalog = {
        ...baseCatalog,
        courses: [
          { id: 1, subject: 'MATH', number: '101', title: 'Algebra', creditsMin: 3, creditsMax: 3 },
          { id: 2, subject: 'MATH', number: '151', title: 'Calc I', creditsMin: 4, creditsMax: 4 },
        ],
      };
      const ast = {
        type: 'all-of',
        items: [
          { type: 'course', subject: 'MATH', number: '101' },
          { type: 'course', subject: 'MATH', number: '151' },
        ],
      };
      const result = resolve(ast, catalog);
      expect(result.courses).toHaveLength(2);
      expect(result.courses[0].attributes).toEqual([]);
      expect(result.courses[1].attributes).toEqual([]);
    });

    it('resolves courses from a catalog with no prerequisites or corequisites', () => {
      const catalog = {
        ...baseCatalog,
        courses: [
          { id: 1, subject: 'CMPS', number: '130', title: 'Intro', creditsMin: 3, creditsMax: 3 },
        ],
      };
      const ast = { type: 'course', subject: 'CMPS', number: '130' };
      const result = resolve(ast, catalog);
      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].prerequisites).toBeNull();
      expect(result.courses[0].corequisites).toBeNull();
    });

    it('resolves courses from a minimal catalog (no optional fields at all)', () => {
      const catalog = {
        institution: 'bare',
        ay: '2025-2026',
        courses: [
          { id: 1, subject: 'X', number: '1', title: 'T', creditsMin: 1, creditsMax: 1 },
        ],
        programs: [],
        attainments: [],
        gradeConfig: { scale: [], passFail: [], withdrawal: [], incomplete: [] },
      };
      const ast = { type: 'course', subject: 'X', number: '1' };
      const result = resolve(ast, catalog);
      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].attributes).toEqual([]);
      expect(result.courses[0].crossListGroup).toBeUndefined();
      expect(result.courses[0].prerequisites).toBeNull();
      expect(result.courses[0].corequisites).toBeNull();
    });
  });
});

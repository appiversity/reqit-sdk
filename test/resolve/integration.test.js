'use strict';

const { resolve } = require('../../src/resolve');
const { parse } = require('../../src/parser');
const lehighCatalog = require('../fixtures/catalogs/lehigh.json');
const moravianCatalog = require('../fixtures/catalogs/moravian.json');
const wmCatalog = require('../fixtures/catalogs/william-mary.json');
const rcnjCatalog = require('../fixtures/catalogs/rcnj.json');
const minimalCatalog = require('../fixtures/catalogs/minimal.json');

/**
 * Helper: parse reqit text and resolve against a catalog.
 */
function parseAndResolve(text, catalog) {
  const ast = parse(text);
  return resolve(ast, catalog);
}

describe('Resolution integration tests', () => {

  describe('Lehigh: tech electives and cross-listing', () => {
    it('resolves explicit CSE course references', () => {
      const result = parseAndResolve(
        'all of (CSE 017, CSE 109, CSE 140, CSE 202)',
        lehighCatalog
      );
      expect(result.courses).toHaveLength(4);
    });

    it('resolves CSE 340 with cross-listed MATH 340', () => {
      const result = parseAndResolve('CSE 340', lehighCatalog);
      expect(result.courses).toHaveLength(2);
      expect(result.courses.some(c => c.subject === 'CSE' && c.number === '340')).toBe(true);
      expect(result.courses.some(c => c.subject === 'MATH' && c.number === '340')).toBe(true);
    });

    it('resolves tech electives as CSE upper-level filter', () => {
      const result = parseAndResolve(
        'courses where subject = "CSE" and number >= 200',
        lehighCatalog
      );
      // CSE courses with number >= 200 + MATH 340 cross-listed
      expect(result.courses).toHaveLength(10);
      const directCSE = result.courses.filter(c => c.subject === 'CSE');
      expect(directCSE.every(c => parseInt(c.number, 10) >= 200)).toBe(true);
      // MATH 340 should also appear (cross-listed with CSE 340)
      expect(result.courses.some(c => c.subject === 'MATH' && c.number === '340')).toBe(true);
    });

    it('resolves HSS elective filter', () => {
      const result = parseAndResolve(
        'courses where attribute = "HSS"',
        lehighCatalog
      );
      expect(result.courses).toHaveLength(6);
      expect(result.courses.every(c => c.attributes.includes('HSS'))).toBe(true);
    });

    it('resolves full CS core program structure', () => {
      const result = parseAndResolve(
        `all of (
          CSE 007,
          CSE 017,
          CSE 109,
          CSE 140,
          CSE 202,
          CSE 216,
          CSE 252,
          CSE 262,
          CSE 280,
          CSE 281,
          CSE 303,
          CSE 340,
          MATH 021,
          MATH 022,
          MATH 205,
          MATH 231
        )`,
        lehighCatalog
      );
      // 16 explicit refs + MATH 340 from cross-list on CSE 340
      expect(result.courses).toHaveLength(17);
    });

    it('resolves calculus alternatives with any-of', () => {
      const result = parseAndResolve(
        'any of (MATH 021, MATH 031, MATH 051, MATH 076)',
        lehighCatalog
      );
      expect(result.courses).toHaveLength(4);
    });
  });

  describe('Moravian: multi-subject pools and variable credits', () => {
    it('resolves CS courses with number filter', () => {
      const result = parseAndResolve(
        'courses where subject = "CSCI" and number >= 200',
        moravianCatalog
      );
      expect(result.courses).toHaveLength(14);
      expect(result.courses.every(c =>
        c.subject === 'CSCI' && parseInt(c.number, 10) >= 200
      )).toBe(true);
    });

    it('resolves multi-subject pool', () => {
      const result = parseAndResolve(
        'courses where subject in ("CSCI", "MATH", "ECON")',
        moravianCatalog
      );
      expect(result.courses).toHaveLength(29);
      expect(result.courses.every(c =>
        ['CSCI', 'MATH', 'ECON'].includes(c.subject)
      )).toBe(true);
    });

    it('resolves credits-from with CS upper-level electives', () => {
      const result = parseAndResolve(
        'at least 12 credits from (courses where subject = "CSCI" and number >= 300)',
        moravianCatalog
      );
      expect(result.filters).toHaveLength(1);
      const matched = result.filters[0].matched;
      expect(matched).toHaveLength(5);
      expect(matched.every(c => c.subject === 'CSCI' && parseInt(c.number, 10) >= 300)).toBe(true);
    });

    it('resolves WI-attributed courses', () => {
      const result = parseAndResolve(
        'courses where attribute = "WI"',
        moravianCatalog
      );
      // Only CSCI 334 has WI in the moravian catalog
      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].subject).toBe('CSCI');
      expect(result.courses[0].number).toBe('334');
    });

    it('resolves with n-of selection from course pool', () => {
      const result = parseAndResolve(
        `at least 2 of (
          CSCI 120,
          CSCI 140,
          CSCI 210,
          MATH 170
        )`,
        moravianCatalog
      );
      expect(result.courses).toHaveLength(4);
    });

    it('resolves variable-credit courses in credits filter', () => {
      const result = parseAndResolve(
        'courses where subject = "CSCI" and credits <= 2',
        moravianCatalog
      );
      // CSCI 220.2 and 243.2 are 2-credit courses
      expect(result.courses).toHaveLength(2);
      expect(result.courses.every(c => c.creditsMin <= 2)).toBe(true);
    });
  });

  describe('William & Mary: attribute-based gen-ed distribution', () => {
    it('resolves COLL150 requirement', () => {
      const result = parseAndResolve(
        'courses where attribute = "COLL150"',
        wmCatalog
      );
      expect(result.courses).toHaveLength(1);
      expect(result.courses.every(c => c.attributes.includes('COLL150'))).toBe(true);
    });

    it('resolves multiple COLL-level attributes', () => {
      const result = parseAndResolve(
        'courses where attribute in ("COLL150", "COLL350", "COLL400")',
        wmCatalog
      );
      expect(result.courses).toHaveLength(3);
      expect(result.courses.every(c =>
        c.attributes.includes('COLL150') ||
        c.attributes.includes('COLL350') ||
        c.attributes.includes('COLL400')
      )).toBe(true);
    });

    it('resolves NQR distribution requirement', () => {
      const result = parseAndResolve(
        'courses where attribute = "NQR"',
        wmCatalog
      );
      expect(result.courses).toHaveLength(6);
      expect(result.courses.every(c => c.attributes.includes('NQR'))).toBe(true);
    });

    it('resolves non-CS courses for breadth', () => {
      const result = parseAndResolve(
        'courses where subject != "CSCI" and subject != "MATH"',
        wmCatalog
      );
      expect(result.courses).toHaveLength(10);
      expect(result.courses.every(c => c.subject !== 'CSCI' && c.subject !== 'MATH')).toBe(true);
    });

    it('resolves CS core with variables and scope', () => {
      const result = parseAndResolve(
        `scope "cs-bs" {
          $core = all of (CSCI 141, CSCI 241, CSCI 243, CSCI 301, CSCI 303)
          $core
        }`,
        wmCatalog
      );
      expect(result.courses).toHaveLength(5);
    });

    it('resolves credits-from with attribute filter', () => {
      const result = parseAndResolve(
        'at least 6 credits from (courses where attribute = "NQR")',
        wmCatalog
      );
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0].matched).toHaveLength(6);
    });
  });

  describe('RCNJ: institution-wide gen-ed filters', () => {
    it('resolves gen-ed QR requirement', () => {
      const result = parseAndResolve(
        'courses where attribute = "GE-QR"',
        rcnjCatalog
      );
      expect(result.courses).toHaveLength(6);
      expect(result.courses.every(c => c.attributes.includes('GE-QR'))).toBe(true);
    });

    it('resolves multiple gen-ed categories', () => {
      const result = parseAndResolve(
        `one from each of (
          courses where attribute = "GE-QR",
          courses where attribute = "GE-FYS",
          courses where attribute = "GE-AH",
          courses where attribute = "GE-SS"
        )`,
        rcnjCatalog
      );
      expect(result.filters).toHaveLength(4);
      expect(result.filters.every(f => f.matched.length > 0)).toBe(true);
    });

    it('resolves CS major course pool', () => {
      const result = parseAndResolve(
        'courses where subject = "CMPS" and number >= 300',
        rcnjCatalog
      );
      expect(result.courses).toHaveLength(20);
      expect(result.courses.every(c =>
        c.subject === 'CMPS' && parseInt(c.number, 10) >= 300
      )).toBe(true);
    });

    it('resolves wildcard filter (all courses)', () => {
      const result = parseAndResolve(
        'courses where subject = "*"',
        rcnjCatalog
      );
      expect(result.courses).toHaveLength(rcnjCatalog.courses.length);
    });

    it('resolves except pattern for elective pool', () => {
      const result = parseAndResolve(
        `courses where subject = "CMPS" except (CMPS 490, CMPS 491)`,
        rcnjCatalog
      );
      // Filter matches all CMPS; except lists 490 and 491 which are already CMPS.
      // Resolver collects both source and exclusion courses.
      const cmpsTotal = rcnjCatalog.courses.filter(c => c.subject === 'CMPS').length;
      expect(result.courses).toHaveLength(cmpsTotal);
    });

    it('resolves credits-from with subject exclusion', () => {
      const result = parseAndResolve(
        'at least 9 credits from (courses where subject in ("CMPS", "DATA", "MATH"))',
        rcnjCatalog
      );
      expect(result.filters).toHaveLength(1);
      const matched = result.filters[0].matched;
      expect(matched.every(c =>
        ['CMPS', 'DATA', 'MATH'].includes(c.subject)
      )).toBe(true);
    });

    it('resolves WI courses from CMPS', () => {
      const result = parseAndResolve(
        'courses where subject = "CMPS" and attribute = "WI"',
        rcnjCatalog
      );
      expect(result.courses).toHaveLength(1);
      expect(result.courses.every(c =>
        c.subject === 'CMPS' && c.attributes.includes('WI')
      )).toBe(true);
    });
  });

  describe('Cross-catalog: prerequisite-includes (minimal catalog)', () => {
    it('resolves courses requiring CMPS 230 as a prerequisite', () => {
      const result = parseAndResolve(
        'courses where prerequisite includes (CMPS 230)',
        minimalCatalog
      );
      // CMPS 310, 320, 350, 360, 380 all require CMPS 230
      expect(result.courses).toHaveLength(5);
    });

    it('resolves courses with MATH prerequisites', () => {
      const result = parseAndResolve(
        'courses where prerequisite includes (MATH 151)',
        minimalCatalog
      );
      // MATH 152 and PHYS 201 directly require MATH 151
      expect(result.courses).toHaveLength(2);
    });

    it('resolves combined prerequisite + subject filter', () => {
      const result = parseAndResolve(
        'courses where subject = "CMPS" and prerequisite includes (CMPS 310)',
        minimalCatalog
      );
      // CMPS 491 requires CMPS 310
      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].number).toBe('491');
    });

    it('resolves corequisite includes filter', () => {
      const result = parseAndResolve(
        'courses where corequisite includes (CMPS 360)',
        minimalCatalog
      );
      // CMPS 492 has CMPS 360 as corequisite
      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].number).toBe('492');
    });
  });

  describe('Complex mixed structures', () => {
    it('resolves a full program requirement with variables, filters, and explicit refs', () => {
      const result = parseAndResolve(
        `scope "cs-program" {
          $core = all of (
            CMPS 130,
            CMPS 135,
            CMPS 230,
            CMPS 310
          )
          all of (
            $core,
            at least 2 of (
              CMPS 320,
              CMPS 350,
              CMPS 360,
              CMPS 380
            ),
            at least 6 credits from (
              courses where subject = "CMPS" and number >= 300
            ),
            at least 2 of (
              courses where attribute = "WI"
            )
          )
        }`,
        minimalCatalog
      );
      // 4 core + 4 elective refs + filter-matched CMPS >= 300 and WI courses
      expect(result.courses).toHaveLength(13);
      expect(result.filters).toHaveLength(2);  // CMPS >= 300 and WI
    });

    it('resolves with-constraint wrapping a filter', () => {
      const result = parseAndResolve(
        'all of (MATH 101, MATH 151) with grade >= "C"',
        minimalCatalog
      );
      expect(result.courses).toHaveLength(2);
    });

    it('resolves credits-from with except', () => {
      const result = parseAndResolve(
        `at least 9 credits from (
          courses where subject = "CMPS" and number >= 300
          except (CMPS 490)
        )`,
        minimalCatalog
      );
      expect(result.filters).toHaveLength(1);
      // CMPS 490 should still appear in courses (except resolves both sides)
      expect(result.courses.some(c => c.number === '490')).toBe(true);
    });
  });
});

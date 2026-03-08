'use strict';

/**
 * Tests for renderer customization options (Issue #8):
 * - toOutline: labelFormat, custom icons, showGrades, showSummary
 * - toHTML: classPrefix, labelFormat
 * - Entity method forwarding: Requirement.toOutline/toHTML, AuditResult.toOutline/toHTML
 */

const { toOutline } = require('../../src/render/to-outline');
const { toHTML } = require('../../src/render/to-html');
const api = require('../../src/index');

const catalog = {
  courses: [
    { subject: 'MATH', number: '151', title: 'Calculus I' },
    { subject: 'MATH', number: '152', title: 'Calculus II' },
    { subject: 'CMPS', number: '230', title: 'Data Structures' },
  ],
};

const allOfAST = {
  type: 'all-of',
  label: 'Math Core',
  items: [
    { type: 'course', subject: 'MATH', number: '151' },
    { type: 'course', subject: 'MATH', number: '152' },
  ],
};

const allOfAudit = {
  type: 'all-of',
  status: 'met',
  summary: { met: 2, total: 2 },
  items: [
    { type: 'course', status: 'met', satisfiedBy: { grade: 'A', term: 'Fall 2023' } },
    { type: 'course', status: 'not-met' },
  ],
};

// ============================================================
// toOutline — labelFormat
// ============================================================

describe('toOutline — labelFormat option', () => {
  test('labelFormat transforms composite label (no audit)', () => {
    const result = toOutline(allOfAST, catalog, null, {
      labelFormat: (label) => label.toUpperCase(),
    });
    expect(result).toContain('MATH CORE \u2014 ALL OF THE FOLLOWING:');
  });

  test('labelFormat transforms composite label (with audit)', () => {
    const result = toOutline(allOfAST, catalog, allOfAudit, {
      labelFormat: (label) => `[custom] ${label}`,
    });
    expect(result).toContain('[custom] Math Core');
  });

  test('labelFormat receives node and catalog', () => {
    const calls = [];
    toOutline(allOfAST, catalog, null, {
      labelFormat: (label, node, cat) => {
        calls.push({ label, nodeType: node.type, hasCatalog: !!cat });
        return label;
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].nodeType).toBe('all-of');
    expect(calls[0].hasCatalog).toBe(true);
  });
});

// ============================================================
// toOutline — custom icons
// ============================================================

describe('toOutline — custom icons option', () => {
  const customIcons = {
    'met': '[OK]',
    'not-met': '[NO]',
    'provisional-met': '[PM]',
    'in-progress': '[IP]',
    'waived': '[WV]',
    'substituted': '[SB]',
  };

  test('custom icons replace default Unicode icons', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const auditNode = { type: 'course', status: 'met', satisfiedBy: { grade: 'A' } };
    const result = toOutline(ast, catalog, auditNode, { icons: customIcons });
    expect(result).toMatch(/^\[OK\] MATH 151/);
  });

  test('not-met with custom icon', () => {
    const ast = { type: 'course', subject: 'MATH', number: '152' };
    const auditNode = { type: 'course', status: 'not-met' };
    const result = toOutline(ast, catalog, auditNode, { icons: customIcons });
    expect(result).toMatch(/^\[NO\] MATH 152/);
  });

  test('custom icons used in composite labels', () => {
    const result = toOutline(allOfAST, catalog, allOfAudit, { icons: customIcons });
    expect(result).toContain('[OK] Math Core');
  });
});

// ============================================================
// toOutline — showGrades
// ============================================================

describe('toOutline — showGrades option', () => {
  test('showGrades: false suppresses grade/term info', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const auditNode = { type: 'course', status: 'met', satisfiedBy: { grade: 'A', term: 'Fall 2023' } };
    const result = toOutline(ast, catalog, auditNode, { showGrades: false });
    expect(result).not.toContain('[A');
    expect(result).not.toContain('Fall 2023');
    expect(result).toContain('\u2713 MATH 151');
  });

  test('showGrades defaults to true (grade info shown)', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const auditNode = { type: 'course', status: 'met', satisfiedBy: { grade: 'A', term: 'Fall 2023' } };
    const result = toOutline(ast, catalog, auditNode);
    expect(result).toContain('[A, Fall 2023]');
  });
});

// ============================================================
// toOutline — showSummary
// ============================================================

describe('toOutline — showSummary option', () => {
  test('showSummary: false suppresses summary counts', () => {
    const result = toOutline(allOfAST, catalog, allOfAudit, { showSummary: false });
    expect(result).not.toContain('(2/2 met)');
    expect(result).toContain('Math Core');
  });

  test('showSummary defaults to true (summary shown)', () => {
    const result = toOutline(allOfAST, catalog, allOfAudit);
    expect(result).toContain('(2/2 met)');
  });
});

// ============================================================
// toHTML — classPrefix
// ============================================================

describe('toHTML — classPrefix option', () => {
  test('custom classPrefix replaces reqit- in non-audit mode', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const result = toHTML(ast, catalog, null, { classPrefix: 'my-' });
    expect(result).toContain('class="my-course"');
    expect(result).toContain('class="my-subject"');
    expect(result).toContain('class="my-number"');
    expect(result).not.toContain('reqit-');
  });

  test('custom classPrefix in composite non-audit', () => {
    const result = toHTML(allOfAST, catalog, null, { classPrefix: 'app-' });
    expect(result).toContain('class="app-requirement app-all-of"');
    expect(result).toContain('class="app-label"');
    expect(result).toContain('class="app-items"');
    expect(result).not.toContain('reqit-');
  });

  test('custom classPrefix in audit mode', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const auditNode = { type: 'course', status: 'met', satisfiedBy: { grade: 'A' } };
    const result = toHTML(ast, catalog, auditNode, { classPrefix: 'deg-' });
    expect(result).toContain('class="deg-course deg-status-met"');
    expect(result).toContain('class="deg-status-indicator"');
    expect(result).toContain('class="deg-grade"');
    expect(result).not.toContain('reqit-');
  });

  test('custom classPrefix in audit composite', () => {
    const result = toHTML(allOfAST, catalog, allOfAudit, { classPrefix: 'x-' });
    expect(result).toContain('class="x-requirement x-all-of x-status-met"');
    expect(result).toContain('class="x-label"');
    expect(result).toContain('class="x-items"');
    expect(result).not.toContain('reqit-');
  });

  test('default classPrefix is reqit-', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const result = toHTML(ast, catalog);
    expect(result).toContain('class="reqit-course"');
  });
});

// ============================================================
// toHTML — labelFormat
// ============================================================

describe('toHTML — labelFormat option', () => {
  test('labelFormat transforms composite label in non-audit mode', () => {
    const result = toHTML(allOfAST, catalog, null, {
      labelFormat: (label) => `<em>Custom:</em> ${label}`,
    });
    expect(result).toContain('<em>Custom:</em>');
  });

  test('labelFormat transforms composite label in audit mode', () => {
    const result = toHTML(allOfAST, catalog, allOfAudit, {
      labelFormat: (label) => `PREFIX ${label}`,
    });
    expect(result).toContain('PREFIX');
  });
});

// ============================================================
// toHTML — named-label with custom prefix
// ============================================================

describe('toHTML — named-label with custom prefix', () => {
  test('named-label span uses custom prefix in non-audit', () => {
    const result = toHTML(allOfAST, catalog, null, { classPrefix: 'my-' });
    expect(result).toContain('class="my-named-label"');
    expect(result).toContain('Math Core');
  });

  test('named-label span uses custom prefix in audit credits-from', () => {
    const creditsAST = {
      type: 'credits-from',
      credits: 6,
      comparison: 'at-least',
      label: 'Science Lab',
      source: { type: 'all-of', items: [
        { type: 'course', subject: 'MATH', number: '151' },
      ] },
    };
    const creditsAudit = {
      type: 'credits-from',
      status: 'not-met',
      source: { type: 'all-of', status: 'not-met', items: [
        { type: 'course', status: 'not-met' },
      ] },
    };
    const result = toHTML(creditsAST, catalog, creditsAudit, { classPrefix: 'z-' });
    expect(result).toContain('class="z-named-label"');
    expect(result).toContain('Science Lab');
    expect(result).not.toContain('reqit-');
  });
});

// ============================================================
// Combined options
// ============================================================

describe('toOutline — combined options', () => {
  test('custom icons + showGrades:false + showSummary:false', () => {
    const result = toOutline(allOfAST, catalog, allOfAudit, {
      icons: { 'met': '+', 'not-met': '-' },
      showGrades: false,
      showSummary: false,
    });
    expect(result).toContain('+ Math Core');
    expect(result).not.toContain('(2/2 met)');
    const lines = result.split('\n');
    const calcLine = lines.find(l => l.includes('MATH 151'));
    expect(calcLine).not.toContain('[A');
  });
});

// ============================================================
// Entity method forwarding
// ============================================================

const entityCatalog = {
  institution: 'test',
  ay: '2025-2026',
  courses: [
    { subject: 'MATH', number: '151', title: 'Calculus I', creditsMin: 4, creditsMax: 4 },
    { subject: 'MATH', number: '152', title: 'Calculus II', creditsMin: 4, creditsMax: 4 },
  ],
};

describe('entity methods forward options', () => {
  test('Requirement.toOutline forwards options', () => {
    const req = api.parse('all of (MATH 151, MATH 152)');
    const cat = api.catalog(entityCatalog);
    const result = req.toOutline(cat, {
      labelFormat: (label) => `[CUSTOM] ${label}`,
    });
    expect(result).toContain('[CUSTOM]');
  });

  test('Requirement.toHTML forwards options', () => {
    const req = api.parse('MATH 151');
    const cat = api.catalog(entityCatalog);
    const result = req.toHTML(cat, { classPrefix: 'test-' });
    expect(result).toContain('class="test-course"');
    expect(result).not.toContain('reqit-');
  });

  test('AuditResult.toOutline forwards options', () => {
    const req = api.parse('MATH 151');
    const cat = api.catalog(entityCatalog);
    const tx = api.transcript({ courses: [{ subject: 'MATH', number: '151', grade: 'A', credits: 4 }] });
    const auditResult = req.audit(cat, tx);
    const result = auditResult.toOutline(cat, {
      icons: { 'met': '[PASS]', 'not-met': '[FAIL]' },
    });
    expect(result).toContain('[PASS]');
  });

  test('AuditResult.toHTML forwards options', () => {
    const req = api.parse('MATH 151');
    const cat = api.catalog(entityCatalog);
    const tx = api.transcript({ courses: [{ subject: 'MATH', number: '151', grade: 'A', credits: 4 }] });
    const auditResult = req.audit(cat, tx);
    const result = auditResult.toHTML(cat, { classPrefix: 'aud-' });
    expect(result).toContain('class="aud-course');
    expect(result).not.toContain('reqit-');
  });
});

// ============================================================
// toHTML — annotations
// ============================================================

describe('toHTML — annotations option', () => {
  test('annotations appear on matching course in non-audit mode', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const annotations = new Map([['MATH:151', ['shared']]]);
    const result = toHTML(ast, catalog, null, { annotations });
    expect(result).toContain('class="reqit-annotation"');
    expect(result).toContain('(shared)');
  });

  test('annotations appear on matching course in audit mode', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const auditNode = { type: 'course', status: 'met', satisfiedBy: { grade: 'A' } };
    const annotations = new Map([['MATH:151', ['shared', 'gen-ed']]]);
    const result = toHTML(ast, catalog, auditNode, { annotations });
    expect(result).toContain('class="reqit-annotation"');
    expect(result).toContain('(shared, gen-ed)');
  });

  test('no annotation span when course has no entry in Map', () => {
    const ast = { type: 'course', subject: 'MATH', number: '152' };
    const annotations = new Map([['MATH:151', ['shared']]]);
    const result = toHTML(ast, catalog, null, { annotations });
    expect(result).not.toContain('annotation');
  });

  test('annotation respects custom classPrefix', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const annotations = new Map([['MATH:151', ['shared']]]);
    const result = toHTML(ast, catalog, null, { annotations, classPrefix: 'my-' });
    expect(result).toContain('class="my-annotation"');
  });
});

// ============================================================
// toHTML — wrapperTag
// ============================================================

describe('toHTML — wrapperTag option', () => {
  test('wraps output in specified tag in non-audit mode', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const result = toHTML(ast, catalog, null, { wrapperTag: 'div' });
    expect(result).toMatch(/^<div class="reqit-root">.*<\/div>$/);
  });

  test('wraps output in specified tag in audit mode', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const auditNode = { type: 'course', status: 'met', satisfiedBy: { grade: 'A' } };
    const result = toHTML(ast, catalog, auditNode, { wrapperTag: 'section' });
    expect(result).toMatch(/^<section class="reqit-root">.*<\/section>$/);
  });

  test('wrapperTag respects custom classPrefix', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const result = toHTML(ast, catalog, null, { wrapperTag: 'div', classPrefix: 'x-' });
    expect(result).toMatch(/^<div class="x-root">.*<\/div>$/);
  });

  test('no wrapper when wrapperTag is not set', () => {
    const ast = { type: 'course', subject: 'MATH', number: '151' };
    const result = toHTML(ast, catalog);
    expect(result).not.toContain('reqit-root');
  });
});

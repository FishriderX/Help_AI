import { buildSystemPrompt, validateLayoutPlan } from '../src/services/claudeAnalyzer.js';

test('buildSystemPrompt includes all page types', () => {
  const prompt = buildSystemPrompt();
  expect(prompt).toContain('paytable');
  expect(prompt).toContain('feature_text');
  expect(prompt).toContain('jackpot');
  expect(prompt).toContain('JSON Layout Plan');
});

test('validateLayoutPlan accepts valid plan', () => {
  const plan = {
    pages: [
      { id: 'PAGE_1', type: 'feature_text', title: 'TEST', body: ['Rule 1'] }
    ]
  };
  expect(() => validateLayoutPlan(plan)).not.toThrow();
});

test('validateLayoutPlan rejects plan without pages array', () => {
  expect(() => validateLayoutPlan({})).toThrow('Layout plan must have a pages array');
});

test('validateLayoutPlan rejects page without id', () => {
  expect(() => validateLayoutPlan({ pages: [{ type: 'feature_text' }] }))
    .toThrow('Page at index 0 missing id');
});

test('validateLayoutPlan rejects page without type', () => {
  expect(() => validateLayoutPlan({ pages: [{ id: 'P1' }] }))
    .toThrow('Page at index 0 missing type');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateKitStructure } from '../src/utils/kitStructure.js';

const kit = {
  source: {
    company: 'Acme Corp',
    company_url: 'https://example.com',
    role: 'Software Engineer',
    location: '',
    jd_chars: 500,
    researched_at: new Date().toISOString(),
    pages_used: ['https://example.com/about']
  },
  company_brief: {
    summary: 'A tech company.',
    what_they_do: 'Builds software.',
    hiring_process: 'Three rounds of interviews.',
    sources: ['https://example.com/about']
  },
  role: {
    title: 'Software Engineer',
    seniority: 'Senior',
    responsibilities: ['Write code'],
    requirements: [
      { id: 'r1', text: 'JavaScript', kind: 'Frontend Technologies', priority: 'must' }
    ]
  },
  questions: [
    {
      id: 'q1',
      requirement_ids: ['r1'],
      category: 'Advanced JavaScript',
      prompt: 'Explain closures.',
      answer_outline: 'Functions bundling scope.',
      difficulty: 2
    }
  ],
  flashcards: [
    { id: 'f1', front: 'What is a closure?', back: 'A bundled scope.', requirement_ids: ['r1'] }
  ],
  schedule: {
    days_available: 1,
    days: [{ day: 1, focus: 'Advanced JavaScript', question_ids: ['q1'], minutes: 20 }]
  },
  coverage: { uncovered_requirement_ids: [], passes: 1 }
};

test('accepts valid kit structure and rejects dangling question references', () => {
  assert.deepEqual(validateKitStructure(kit), []);
  
  const invalidReference = structuredClone(kit);
  invalidReference.schedule.days[0].question_ids = ['q99'];
  assert.ok(validateKitStructure(invalidReference).length > 0);
  
  const invalidCategory = structuredClone(kit);
  invalidCategory.questions[0].category = '   '; 
  assert.ok(validateKitStructure(invalidCategory).length > 0);
});
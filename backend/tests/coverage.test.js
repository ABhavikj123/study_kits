import test from 'node:test';
import assert from 'node:assert/strict';
import { findUncoveredRequirements } from '../src/services/coverageService.js';

test('reports all uncovered requirements regardless of priority', () => {
  const requirements = [
    { id: 'r1', priority: 'must' },
    { id: 'r2', priority: 'must' },
    { id: 'r3', priority: 'nice' }
  ];
  const questions = [
    { requirement_ids: ['r1'] }
  ];
  
  assert.deepEqual(
    findUncoveredRequirements(requirements, questions), 
    ['r2', 'r3']
  );
});
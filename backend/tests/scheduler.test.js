import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule } from '../src/services/schedulerService.js';

test('uses exactly requested days, integer minutes, and prioritizes difficult must-haves', () => {
  const requirements = [
    { id: 'r1', priority: 'must' },
    { id: 'r2', priority: 'nice' },
    { id: 'r3', priority: 'must' }
  ];
  
  const questions = [
    { id: 'q1', requirement_ids: ['r2'], difficulty: 1, category: 'Technical foundations' },
    { id: 'q2', requirement_ids: ['r1'], difficulty: 3, category: 'Technical foundations' },
    { id: 'q3', requirement_ids: ['r3'], difficulty: 2, category: 'Behavioural examples' }
  ];
  
  const schedule = buildSchedule(questions, requirements, 4);
  
  assert.equal(schedule.days.length, 4);
  assert.ok(schedule.days.every((day) => Number.isInteger(day.minutes)));
  // q2 is a difficulty 3 'must', so it should be scheduled first
  assert.equal(schedule.days[0].question_ids[0], 'q2');
});
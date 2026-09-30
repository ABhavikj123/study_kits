export function validateKitStructure(kit) {
  const errors = [];
  const add = (condition, message) => {
    if (!condition) errors.push(message);
  };

  add(kit && typeof kit === 'object', 'Kit must be an object.');
  if (!kit) return errors;

  add(
    kit.source &&
      typeof kit.source.company_url === 'string' &&
      Array.isArray(kit.source.pages_used),
    'Invalid source.'
  );

  add(
    kit.company_brief &&
      typeof kit.company_brief.summary === 'string' &&
      typeof kit.company_brief.what_they_do === 'string' &&
      Array.isArray(kit.company_brief.sources),
    'Invalid company brief.'
  );

  add(
    kit.role &&
      typeof kit.role.title === 'string' &&
      Array.isArray(kit.role.responsibilities) &&
      Array.isArray(kit.role.requirements),
    'Invalid role.'
  );

  const requirementIds = new Set();
  for (const requirement of kit.role?.requirements || []) {
    add(
      /^r\d+$/.test(requirement.id || '') && !requirementIds.has(requirement.id),
      'Requirements need unique stable ids.'
    );
    requirementIds.add(requirement.id);
    add(
      typeof requirement.kind === 'string' && requirement.kind.trim() !== '',
      'Invalid requirement kind.'
    );
    add(
      ['must', 'nice'].includes(requirement.priority),
      'Invalid requirement priority.'
    );
  }

  const questionIds = new Set();
  for (const question of kit.questions || []) {
    add(
      /^q\d+$/.test(question.id || '') && !questionIds.has(question.id),
      'Questions need unique stable ids.'
    );
    questionIds.add(question.id);
    add(
      typeof question.category === 'string' && question.category.trim() !== '',
      'Invalid question category.'
    );
    add([1, 2, 3].includes(question.difficulty), 'Invalid question difficulty.');
    add(
      Array.isArray(question.requirement_ids) &&
        question.requirement_ids.every((id) => requirementIds.has(id)),
      'Question references unknown requirement.'
    );
  }

  add(Array.isArray(kit.flashcards), 'Invalid flashcards.');
  for (const card of kit.flashcards || []) {
    add(
      Array.isArray(card.requirement_ids) &&
        card.requirement_ids.every((id) => requirementIds.has(id)),
      'Flashcard references unknown requirement.'
    );
  }

  add(
    kit.schedule &&
      Number.isInteger(kit.schedule.days_available) &&
      kit.schedule.days.length === kit.schedule.days_available,
    'Schedule must have exactly days_available days.'
  );
  for (const day of kit.schedule?.days || []) {
    add(Number.isInteger(day.minutes), 'Schedule minutes must be integers.');
    add(
      Array.isArray(day.question_ids) &&
        day.question_ids.every((id) => questionIds.has(id)),
      'Schedule references unknown question.'
    );
  }

  add(
    kit.coverage &&
      Array.isArray(kit.coverage.uncovered_requirement_ids) &&
      Number.isInteger(kit.coverage.passes),
    'Invalid coverage.'
  );

  return errors;
}

export function assertValidKit(kit) {
  const errors = validateKitStructure(kit);
  if (errors.length) {
    throw new Error(`Generated kit failed structure validation: ${errors.join(' ')}`);
  }
  return kit;
}
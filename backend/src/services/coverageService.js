export function findUncoveredRequirements(requirements, questions) {
  const covered = new Set(questions.flatMap((question) => question.requirement_ids || []));
  return requirements
    .filter((requirement) => !covered.has(requirement.id))
    .map((requirement) => requirement.id);
}

export const buildCoverage = (requirements, questions, passes) => ({
  uncovered_requirement_ids: findUncoveredRequirements(requirements, questions),
  passes
});
const minutesFor = (difficulty) => ({ 1: 10, 2: 20, 3: 30 }[difficulty] || 20);

export function buildSchedule(questions, requirements, daysAvailable) {
  const requirementPriority = new Map(requirements.map((item) => [item.id, item.priority]));

  const sorted = [...questions].sort((a, b) => {
    const ap = (a.requirement_ids || []).some((id) => requirementPriority.get(id) === 'must') ? 1 : 0;
    const bp = (b.requirement_ids || []).some((id) => requirementPriority.get(id) === 'must') ? 1 : 0;
    return bp - ap || b.difficulty - a.difficulty || a.id.localeCompare(b.id);
  });

  const buckets = Array.from({ length: daysAvailable }, () => []);
  const totals = Array(daysAvailable).fill(0);
  const target = sorted.reduce((sum, question) => sum + minutesFor(question.difficulty), 0) / daysAvailable;

  for (const question of sorted) {
    let day = totals.findIndex((total) => total < target);
    if (day === -1) day = totals.indexOf(Math.min(...totals));
    buckets[day].push(question);
    totals[day] += minutesFor(question.difficulty);
  }

  return {
    days_available: daysAvailable,
    days: buckets.map((bucket, index) => {
      const categories = bucket.map((question) => question.category);
      const dominant = categories.sort(
        (a, b) => categories.filter((c) => c === b).length - categories.filter((c) => c === a).length
      )[0];

      return {
        day: index + 1,
        focus: dominant || 'Review and consolidation',
        question_ids: bucket.map((question) => question.id),
        minutes: totals[index]
      };
    })
  };
}
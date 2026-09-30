import { generateJson } from '../utils/geminiClient.js';

const schema = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      requirement_ids: {
        type: 'ARRAY',
        items: { type: 'STRING' }
      },
      category: {
        type: 'STRING'
      },
      prompt: { type: 'STRING' },
      answer_outline: { type: 'STRING' },
      difficulty: {
        type: 'INTEGER',
        minimum: 1,
        maximum: 3
      }
    },
    required: ['requirement_ids', 'category', 'prompt', 'answer_outline', 'difficulty']
  }
};

export async function generateQuestions(requirements, companyBrief, signal, startingIndex = 1) {
  if (!requirements.length) return [];

  const groups = new Map();
  for (const requirement of requirements) {
    const kind = requirement.kind || 'general';
    groups.set(kind, [...(groups.get(kind) || []), requirement]);
  }

  const generated = [];
  for (const [kind, group] of groups) {
    const rows = await generateJson({
      signal,
      schema,
      prompt: `Generate a comprehensive set of interview questions targeting the provided requirements.

CRITICAL RULES:
1. Broad Categorization: Group questions into a small number of broad, standard interview phases (e.g., 'System Design', 'Frontend Architecture', 'Behavioral', 'Core Technical'). DO NOT create highly specific, granular, or bloat categories.
2. Multi-Requirement Scenarios: Design complex, realistic interview questions that synthesize and test *multiple* related requirements simultaneously whenever possible.
3. High-Volume Exhaustive Coverage: You MUST generate an extensive, high-volume battery of questions. Do not stop at basic or minimal coverage. Generate multiple distinct questions exploring different difficulty levels, edge cases, and theoretical vs. practical angles for the provided requirements to ensure the candidate has a deep well of practice material.
4. Accurate Mapping: Every question must accurately reference the specific requirement IDs it evaluates.
5. Strategic Alignment: Incorporate the provided company brief to appropriately contextualize the scenarios, expectations, and answer outlines.

REQUIREMENTS FOR THIS BATCH (${kind}):
${JSON.stringify(group)}

COMPANY BRIEF:
${JSON.stringify(companyBrief)}`
    });

    generated.push(
      ...rows.map((row) => ({
        ...row,
        requirement_ids: row.requirement_ids.filter((id) =>
          group.some((requirement) => requirement.id === id)
        ),
        difficulty: Math.max(1, Math.min(3, Number(row.difficulty) || 2))
      }))
    );
  }

  return generated
    .filter((question) => question.requirement_ids.length && question.prompt && question.answer_outline)
    .map((question, index) => ({
      ...question,
      id: `q${startingIndex + index}`,
      is_edited: false
    }));
}

export const generateTargetedQuestions = (requirements, companyBrief, signal, startingIndex) =>
  generateQuestions(requirements, companyBrief, signal, startingIndex);
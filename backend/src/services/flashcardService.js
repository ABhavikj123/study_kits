import { generateJson } from '../utils/geminiClient.js';

const schema = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      front: { type: 'STRING' },
      back: { type: 'STRING' },
      requirement_ids: {
        type: 'ARRAY',
        items: { type: 'STRING' }
      }
    },
    required: ['front', 'back', 'requirement_ids']
  }
};

export async function generateFlashcards(requirements, signal) {
  if (!requirements.length) return [];

  const rows = await generateJson({
    signal,
    schema,
    prompt: `Generate rapid-recall flashcards to serve as a technical and behavioral knowledge quiz based on the underlying skills in the job requirements.

CRITICAL RULES:
1. Test Subject Matter, Not the Job Description: DO NOT ask meta-questions about the text of the job description (e.g., NEVER ask "How many years of experience are required with X?"). Instead, generate actual subject-matter trivia, definitions, syntax checks, or scenario outcomes that test the underlying knowledge of the required skill.
2. Direct Fact Checks: Formulate direct, concise question-and-answer pairs for the 'front' and 'back' of each card.
3. High-Volume Generation: You MUST generate multiple, distinct flashcards for EACH individual requirement. Do not settle for just one card per skill. Break each required skill down into various testable micro-facts, definitions, common pitfalls, and syntax checks to build a massive, robust practice deck.
4. Mapping: Every flashcard must accurately cite the specific requirement IDs it targets.

REQUIREMENTS:
${JSON.stringify(requirements)}`
  });

  const ids = new Set(requirements.map((requirement) => requirement.id));

  return rows
    .filter((row) => row.front && row.back)
    .map((row, index) => ({
      id: `f${index + 1}`,
      front: row.front,
      back: row.back,
      requirement_ids: (row.requirement_ids || []).filter((id) => ids.has(id)),
      confidence: null
    }));
}
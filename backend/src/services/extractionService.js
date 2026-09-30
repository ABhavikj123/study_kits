import { generateJson } from '../utils/geminiClient.js';

const schema = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    seniority: { type: 'STRING' },
    responsibilities: {
      type: 'ARRAY',
      items: { type: 'STRING' }
    },
    requirements: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          kind: { type: 'STRING' },
          priority: {
            type: 'STRING',
            enum: ['must', 'nice']
          }
        },
        required: ['text', 'kind', 'priority']
      }
    }
  },
  required: ['title', 'seniority', 'responsibilities', 'requirements']
};

export async function extractRole(jobDescription, signal) {
  const output = await generateJson({
    signal,
    schema,
    prompt: `Extract all distinct, testable skills, competencies, and topics from the provided job description.

CRITICAL RULES:
1. Comprehensive Extraction: Capture all aspects of the role. Include technical tools, system design expectations, behavioral traits, leadership qualities, and domain/industry knowledge. 
2. Granularity: Decompose compound requirements into distinct, individual testable topics (e.g., separate a list of frameworks into individual items).
3. Filtration: Strictly exclude non-testable background criteria like years of experience, educational degrees, and company perks.
4. Categorization: Assign a broad, logical string to the 'kind' field that groups the skill (e.g., 'technical', 'system-design', 'behavioural', 'domain').
5. Strict Fidelity: Designate explicitly stated mandatory qualifications as 'must', and preferred or bonus qualifications as 'nice'.

JOB DESCRIPTION:
${jobDescription}`
  });

  return {
    title: output.title || '',
    seniority: output.seniority || '',
    responsibilities: output.responsibilities || [],
    requirements: (output.requirements || []).map((item, index) => ({
      id: `r${index + 1}`,
      text: item.text.trim(),
      kind: item.kind,
      priority: item.priority
    }))
  };
}
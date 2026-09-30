import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { KitOrchestrator } from '../src/services/KitOrchestrator.js';

const args = process.argv.slice(2);
const value = (name) => args[args.indexOf(name) + 1];
const inputPath = value('--input');
const outputPath = value('--output');

if (!inputPath || !outputPath) {
  console.error('Usage: npm run evaluate -- --input input_file.json --output output_file.json');
  process.exit(1);
}

const cases = JSON.parse(await readFile(inputPath, 'utf8'));
if (!Array.isArray(cases)) throw new Error('Input must be an array of cases.');
const results = [];

for (const item of cases) {
  try {
    const kit = await KitOrchestrator.run(
      { 
        jobDescription: item.jd, 
        companyUrl: item.company_url, 
        days: item.days 
      }, 
      { persist: false }
    );
    results.push({ id: item.id, status: 'ok', kit, error: null });
  } catch (error) {
    results.push({ 
      id: item.id, 
      status: 'failed', 
      kit: null, 
      error: { 
        code: error.code || 'GENERATION_FAILED', 
        message: error.message 
      } 
    });
  }
}

const finalOutput = {
  version: "1.0",
  generated_at: new Date().toISOString(),
  kits: results
};

await writeFile(outputPath, JSON.stringify(finalOutput, null, 2) + '\n');
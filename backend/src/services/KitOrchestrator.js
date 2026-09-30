import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo.js';
import { COLLECTIONS } from '../db/schemas.js';
import { emitKitEvent } from '../utils/eventBus.js';
import { assertValidKit } from '../utils/kitStructure.js';
import { crawlCompanySite } from './scraperService.js';
import { findInterviewDiscussion } from './interviewResearchService.js';
import { extractRole } from './extractionService.js';
import { generateCompanyBrief } from './companyBriefService.js';
import { generateQuestions, generateTargetedQuestions } from './questionService.js';
import { generateFlashcards } from './flashcardService.js';
import { buildCoverage } from './coverageService.js';
import { buildSchedule } from './schedulerService.js';

export const activeJobs = new Map();

const ensureActive = (signal) => {
  if (signal?.aborted) {
    const error = new Error('Generation cancelled.');
    error.code = 'CANCELLED';
    throw error;
  }
};

const stage = (kitId, name, message) => {
  if (kitId) emitKitEvent(kitId, 'progress', { stage: name, message, status: 'pending' });
};

export class KitOrchestrator {
  static async run({ id, jobDescription, companyUrl, days, userId }, { persist = Boolean(id) } = {}) {
    const kitId = id?.toString();
    const controller = new AbortController();
    if (kitId) activeJobs.set(kitId, controller);
    const signal = controller.signal;

    try {
      stage(kitId, 'research', 'Researching company website');
      const crawl = await crawlCompanySite(companyUrl, signal);
      ensureActive(signal);

      const company = (() => {
        try {
          return new URL(companyUrl).hostname.replace(/^www\./, '');
        } catch {
          return '';
        }
      })();

      const discussion = await findInterviewDiscussion(company, signal);
      ensureActive(signal);

      stage(kitId, 'extraction', 'Extracting role requirements');
      const role = await extractRole(jobDescription, signal);
      ensureActive(signal);

      stage(kitId, 'brief', 'Building company brief');
      const sources = [...crawl.pages_used, ...discussion.sources.map((item) => item.url)];
      const company_brief = await generateCompanyBrief({
        companyText: crawl.homepage,
        careerText: crawl.pages.map((page) => page.text).join('\n'),
        discussion: discussion.sources,
        sources,
        signal
      });

      stage(kitId, 'questions', 'Generating interview questions');
      let questions = await generateQuestions(role.requirements, company_brief, signal);
      let coverage = buildCoverage(role.requirements, questions, 1);

      if (coverage.uncovered_requirement_ids.length) {
        stage(kitId, 'coverage', 'Closing question coverage gaps');
        const missing = role.requirements.filter((requirement) =>
          coverage.uncovered_requirement_ids.includes(requirement.id)
        );
        questions = [
          ...questions,
          ...(await generateTargetedQuestions(missing, company_brief, signal, questions.length + 1))
        ];
        coverage = buildCoverage(role.requirements, questions, 2);
      }

      if (coverage.uncovered_requirement_ids.length) {
        throw new Error('Could not cover every requirement after two passes.');
      }

      stage(kitId, 'flashcards', 'Creating flashcards');
      const flashcards = await generateFlashcards(role.requirements, signal);
      ensureActive(signal);

      const kit = {
        source: {
          company,
          company_url: companyUrl,
          role: role.title,
          location: '',
          jd_chars: jobDescription.length,
          researched_at: new Date().toISOString(),
          pages_used: crawl.pages_used
        },
        company_brief,
        role,
        questions,
        flashcards,
        schedule: buildSchedule(questions, role.requirements, days),
        coverage,
        research: {
          errors: [
            ...crawl.errors,
            ...(discussion.error ? [`Public interview discussion: ${discussion.error}`] : [])
          ]
        }
      };

      assertValidKit(kit);

      if (persist) {
        const db = await getDb();
        await db.collection(COLLECTIONS.KITS).updateOne(
          { _id: new ObjectId(id), userId },
          { $set: { ...kit, status: 'completed', error: null, updatedAt: new Date() } }
        );
      }

      if (kitId) {
        emitKitEvent(kitId, 'complete', {
          stage: 'complete',
          message: 'Kit ready',
          status: 'completed'
        });
      }

      return kit;
    } catch (error) {
      const cancelled = signal.aborted || error.code === 'CANCELLED';

      if (persist) {
        const db = await getDb();
        await db.collection(COLLECTIONS.KITS).updateOne(
          { _id: new ObjectId(id), userId },
          {
            $set: {
              status: cancelled ? 'cancelled' : 'failed',
              error: {
                code: cancelled ? 'CANCELLED' : 'GENERATION_FAILED',
                message: error.message
              },
              updatedAt: new Date()
            }
          }
        );
      }

      if (kitId) {
        emitKitEvent(kitId, cancelled ? 'cancelled' : 'failed', {
          stage: 'complete',
          message: error.message,
          status: cancelled ? 'cancelled' : 'failed'
        });
      }

      throw error;
    } finally {
      if (kitId) activeJobs.delete(kitId);
    }
  }
}
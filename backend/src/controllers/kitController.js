import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '../db/schemas.js';
import { getDb } from '../db/mongo.js';
import { ApiError } from '../utils/apiError.js';
import { eventBus } from '../utils/eventBus.js';
import { activeJobs, KitOrchestrator } from '../services/KitOrchestrator.js';
import { buildCoverage } from '../services/coverageService.js';
import { buildSchedule } from '../services/schedulerService.js';
import { generateTargetedQuestions } from '../services/questionService.js';
import { generateCompanyBrief } from '../services/companyBriefService.js';
import { crawlCompanySite } from '../services/scraperService.js';

const id = (value) => {
  if (!ObjectId.isValid(value)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid kit id.');
  return new ObjectId(value);
};

async function ownedKit(req) {
  const kit = await (await getDb()).collection(COLLECTIONS.KITS).findOne({ _id: id(req.params.id), userId: req.userId });
  if (!kit) throw new ApiError(404, 'NOT_FOUND', 'Kit not found.');
  return kit;
}

const nextQuestionId = (questions) => `q${Math.max(0, ...questions.map((q) => Number(q.id.slice(1)) || 0)) + 1}`;

export async function createKit(req, res, next) {
  try {
    const { jobDescription, companyUrl, days } = req.body || {};
    if (
      typeof jobDescription !== 'string' ||
      !jobDescription.trim() ||
      typeof companyUrl !== 'string' ||
      !companyUrl.trim() ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > 60
    ) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'jobDescription, companyUrl, and days (1–60) are required.');
    }

    const db = await getDb();
    const kit = {
      userId: req.userId,
      status: 'pending',
      error: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      input: {
        jobDescription: jobDescription.trim(),
        companyUrl: companyUrl.trim(),
        days
      }
    };

    const result = await db.collection(COLLECTIONS.KITS).insertOne(kit);
    KitOrchestrator.run({
      id: result.insertedId,
      jobDescription: kit.input.jobDescription,
      companyUrl: kit.input.companyUrl,
      days,
      userId: req.userId
    }).catch(() => {});

    return res.status(202).json({ kitId: result.insertedId.toString(), status: 'started' });
  } catch (error) {
    return next(error);
  }
}

export async function listKits(req, res, next) {
  try {
    const kits = await (await getDb())
      .collection(COLLECTIONS.KITS)
      .find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .toArray();
    return res.json({ kits });
  } catch (error) {
    return next(error);
  }
}

export async function getKit(req, res, next) {
  try {
    return res.json(await ownedKit(req));
  } catch (error) {
    return next(error);
  }
}

export async function streamKit(req, res, next) {
  try {
    await ownedKit(req);
    const kitId = req.params.id;

    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();

    const listener = (event) => res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    eventBus.on(`kit:${kitId}`, listener);

    const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      eventBus.off(`kit:${kitId}`, listener);
    });
  } catch (error) {
    return next(error);
  }
}

export async function cancelKit(req, res, next) {
  try {
    const kit = await ownedKit(req);
    const controller = activeJobs.get(kit._id.toString());
    if (controller) controller.abort();

    await (await getDb()).collection(COLLECTIONS.KITS).updateOne(
      { _id: kit._id },
      { $set: { status: 'cancelled', updatedAt: new Date() } }
    );

    return res.json({ kitId: kit._id.toString(), status: 'cancelled' });
  } catch (error) {
    return next(error);
  }
}

export async function patchQuestion(req, res, next) {
  try {
    const kit = await ownedKit(req);
    const changes = {};

    for (const key of ['prompt', 'answer_outline', 'category']) {
      if (req.body?.[key] !== undefined) changes[`questions.$.${key}`] = req.body[key];
    }

    if (!Object.keys(changes).length) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'No editable question fields supplied.');
    }

    changes['questions.$.is_edited'] = true;

    const result = await (await getDb()).collection(COLLECTIONS.KITS).findOneAndUpdate(
      { _id: kit._id, 'questions.id': req.params.questionId },
      { $set: changes },
      { returnDocument: 'after' }
    );

    if (!result) throw new ApiError(404, 'NOT_FOUND', 'Question not found.');
    return res.json({ question: result.questions.find((q) => q.id === req.params.questionId) });
  } catch (error) {
    return next(error);
  }
}

export async function addQuestion(req, res, next) {
  try {
    const kit = await ownedKit(req);
    const { requirement_ids, category, prompt, answer_outline, difficulty } = req.body || {};

    if (
      !Array.isArray(requirement_ids) ||
      typeof category !== 'string' ||
      !category.trim() ||
      !prompt ||
      !answer_outline ||
      ![1, 2, 3].includes(difficulty)
    ) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid question payload.');
    }

    const question = {
      id: nextQuestionId(kit.questions),
      requirement_ids,
      category,
      prompt,
      answer_outline,
      difficulty,
      is_edited: true
    };

    await (await getDb()).collection(COLLECTIONS.KITS).updateOne(
      { _id: kit._id },
      { $push: { questions: question },$set: { updatedAt: new Date() } }
    );

    return res.status(201).json({ question });
  } catch (error) {
    return next(error);
  }
}

export async function deleteQuestion(req, res, next) {
  try {
    const kit = await ownedKit(req);
    const questionId = req.params.questionId;

    await (await getDb()).collection(COLLECTIONS.KITS).updateOne(
      { _id: kit._id },
      {
        $pull: {
          questions: { id: questionId },
          'schedule.days.$[].question_ids': questionId
        },
        $set: { updatedAt: new Date() }
      }
    );

    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}

export async function regenerateCategory(req, res, next) {
  try {
    const kit = await ownedKit(req);
    const { category } = req.body || {};

    if (typeof category !== 'string' || !category.trim()) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid category.');
    }

    const retained = kit.questions.filter((q) => q.category !== category || q.is_edited);
    const referenced = new Set(
      kit.questions
        .filter((q) => q.category === category && !q.is_edited)
        .flatMap((q) => q.requirement_ids)
    );
    const requirements = kit.role.requirements.filter((r) => referenced.has(r.id));
    const generated = await generateTargetedQuestions(
      requirements,
      kit.company_brief,
      undefined,
      Math.max(0, ...kit.questions.map((q) => Number(q.id.slice(1)) || 0)) + 1
    );

    const questions = [...retained, ...generated];
    const coverage = buildCoverage(kit.role.requirements, questions, kit.coverage.passes + 1);

    await (await getDb()).collection(COLLECTIONS.KITS).updateOne(
      { _id: kit._id },
      { $set: { questions, coverage, updatedAt: new Date() } }
    );

    return res.json({ questions, coverage });
  } catch (error) {
    return next(error);
  }
}

export async function regenerateSchedule(req, res, next) {
  try {
    const kit = await ownedKit(req);
    const days = req.body?.days ?? kit.schedule.days_available;

    if (!Number.isInteger(days) || days < 1 || days > 60) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'days must be 1–60.');
    }

    const schedule = buildSchedule(kit.questions, kit.role.requirements, days);

    await (await getDb()).collection(COLLECTIONS.KITS).updateOne(
      { _id: kit._id },
      { $set: { schedule, updatedAt: new Date() } }
    );

    return res.json({ schedule });
  } catch (error) {
    return next(error);
  }
}

export async function shiftScheduleQuestion(req, res, next) {
  try {
    const kit = await ownedKit(req);
    const questionId = req.params.questionId;
    const targetDay = req.body?.targetDay;

    if (!Number.isInteger(targetDay) || targetDay < 1 || targetDay > kit.schedule.days_available) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid target day.');
    }
    
    if (!kit.questions.some((q) => q.id === questionId)) {
      throw new ApiError(404, 'NOT_FOUND', 'Question not found.');
    }

    const days = kit.schedule.days.map((day) => ({
      ...day,
      question_ids: day.question_ids.filter((id) => id !== questionId)
    }));

    days[targetDay - 1].question_ids.push(questionId);

    const minutesFor = (difficulty) => ({ 1: 10, 2: 20, 3: 30 }[difficulty] || 20);
    for (const day of days) {
      day.minutes = day.question_ids.reduce((sum, id) => {
        const q = kit.questions.find((x) => x.id === id);
        return sum + (q ? minutesFor(q.difficulty) : 0);
      }, 0);
    }

    await (await getDb()).collection(COLLECTIONS.KITS).updateOne(
      { _id: kit._id },
      { $set: { 'schedule.days': days, updatedAt: new Date() } }
    );

    return res.json({ schedule: { ...kit.schedule, days } });
  } catch (error) {
    return next(error);
  }
}

export async function patchConfidence(req, res, next) {
  try {
    const kit = await ownedKit(req);
    const confidence = req.body?.confidence;

    if (![1, 3, 5].includes(confidence)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'confidence must be 1, 3, or 5.');
    }

    const result = await (await getDb()).collection(COLLECTIONS.KITS).findOneAndUpdate(
      { _id: kit._id, 'flashcards.id': req.params.flashcardId },
      { $set: { 'flashcards.$.confidence': confidence, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result) throw new ApiError(404, 'NOT_FOUND', 'Flashcard not found.');
    return res.json({ flashcard: result.flashcards.find((f) => f.id === req.params.flashcardId) });
  } catch (error) {
    return next(error);
  }
}

export async function regenerateBrief(req, res, next) {
  try {
    const kit = await ownedKit(req);
    const crawl = await crawlCompanySite(kit.source.company_url);
    const company_brief = await generateCompanyBrief({
      companyText: crawl.homepage,
      careerText: crawl.pages.map((page) => page.text).join('\n'),
      discussion: [],
      sources: crawl.pages_used
    });

    await (await getDb()).collection(COLLECTIONS.KITS).updateOne(
      { _id: kit._id },
      { $set: { company_brief, 'source.pages_used': crawl.pages_used, updatedAt: new Date() } }
    );

    return res.json({ company_brief });
  } catch (error) {
    return next(error);
  }
}

export async function deleteKit(req, res, next) {
  try {
    const result = await (await getDb())
      .collection(COLLECTIONS.KITS)
      .deleteOne({ _id: id(req.params.id), userId: req.userId });

    if (!result.deletedCount) throw new ApiError(404, 'NOT_FOUND', 'Kit not found.');

    const controller = activeJobs.get(req.params.id);
    if (controller) controller.abort();

    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}

export async function reorderQuestions(req, res, next) {
  try {
    const kit = await ownedKit(req);
    const questionIds = req.body?.questionIds;

    if (
      !Array.isArray(questionIds) ||
      questionIds.length !== kit.questions.length ||
      new Set(questionIds).size !== questionIds.length ||
      !questionIds.every((questionId) => kit.questions.some((question) => question.id === questionId))
    ) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'questionIds must contain every question exactly once.');
    }

    const byId = new Map(kit.questions.map((question) => [question.id, question]));
    const questions = questionIds.map((questionId) => byId.get(questionId));

    await (await getDb()).collection(COLLECTIONS.KITS).updateOne(
      { _id: kit._id },
      { $set: { questions, updatedAt: new Date() } }
    );

    return res.json({ questions });
  } catch (error) {
    return next(error);
  }
}

export async function reorderFlashcards(req, res, next) {
  try {
    const kit = await ownedKit(req);
    const flashcardIds = req.body?.flashcardIds;

    if (
      !Array.isArray(flashcardIds) ||
      flashcardIds.length !== kit.flashcards.length ||
      new Set(flashcardIds).size !== flashcardIds.length ||
      !flashcardIds.every((flashcardId) => kit.flashcards.some((f) => f.id === flashcardId))
    ) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'flashcardIds must contain every flashcard exactly once.');
    }

    const byId = new Map(kit.flashcards.map((f) => [f.id, f]));
    const flashcards = flashcardIds.map((id) => byId.get(id));

    await (await getDb()).collection(COLLECTIONS.KITS).updateOne(
      { _id: kit._id },
      { $set: { flashcards, updatedAt: new Date() } }
    );

    return res.json({ flashcards });
  } catch (error) {
    return next(error);
  }
}

export async function patchFlashcard(req, res, next) {
  try {
    const kit = await ownedKit(req);
    const changes = {};

    for (const key of ['front', 'back', 'requirement_ids']) {
      if (req.body?.[key] !== undefined) changes[`flashcards.$.${key}`] = req.body[key];
    }

    if (!Object.keys(changes).length) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'No editable flashcard fields supplied.');
    }

    const result = await (await getDb()).collection(COLLECTIONS.KITS).findOneAndUpdate(
      { _id: kit._id, 'flashcards.id': req.params.flashcardId },
      { $set: changes },
      { returnDocument: 'after' }
    );

    if (!result) throw new ApiError(404, 'NOT_FOUND', 'Flashcard not found.');
    return res.json({ flashcard: result.flashcards.find((card) => card.id === req.params.flashcardId) });
  } catch (error) {
    return next(error);
  }
}

export async function addFlashcard(req, res, next) {
  try {
    const kit = await ownedKit(req);
    const { front, back, requirement_ids = [] } = req.body || {};

    if (!front || !back || !Array.isArray(requirement_ids)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'front, back, and requirement_ids are required.');
    }

    const card = {
      id: `f${Math.max(0, ...kit.flashcards.map((item) => Number(item.id.slice(1)) || 0)) + 1}`,
      front,
      back,
      requirement_ids,
      confidence: null,
      is_edited: true
    };

    await (await getDb()).collection(COLLECTIONS.KITS).updateOne(
      { _id: kit._id },
      { $push: { flashcards: card },$set: { updatedAt: new Date() } }
    );

    return res.status(201).json({ flashcard: card });
  } catch (error) {
    return next(error);
  }
}

export async function deleteFlashcard(req, res, next) {
  try {
    const kit = await ownedKit(req);

    const result = await (await getDb()).collection(COLLECTIONS.KITS).updateOne(
      { _id: kit._id, 'flashcards.id': req.params.flashcardId },
      {
        $pull: { flashcards: { id: req.params.flashcardId } },$set: { updatedAt: new Date() }
      }
    );

    if (!result.modifiedCount) throw new ApiError(404, 'NOT_FOUND', 'Flashcard not found.');
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}

export async function patchBrief(req, res, next) {
  try {
    const kit = await ownedKit(req);
    const changes = {};

    for (const key of ['summary', 'what_they_do', 'hiring_process']) {
      if (req.body?.[key] !== undefined) changes[`company_brief.${key}`] = req.body[key];
    }

    if (!Object.keys(changes).length) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'No editable brief fields supplied.');
    }

    await (await getDb()).collection(COLLECTIONS.KITS).updateOne(
      { _id: kit._id },
      { $set: { ...changes, updatedAt: new Date() } }
    );

    return res.json({
      company_brief: {
        ...kit.company_brief,
        ...req.body,
        is_edited: true
      }
    });
  } catch (error) {
    return next(error);
  }
}
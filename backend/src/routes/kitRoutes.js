import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import * as controller from '../controllers/kitController.js';

export const kitRouter = Router();

kitRouter.use(requireAuth);

kitRouter.post('/', controller.createKit);
kitRouter.get('/', controller.listKits);
kitRouter.get('/:id/stream', controller.streamKit);
kitRouter.delete('/:id', controller.deleteKit);
kitRouter.post('/:id/cancel', controller.cancelKit);

kitRouter.post('/:id/questions/reorder', controller.reorderQuestions);
kitRouter.post('/:id/questions', controller.addQuestion);
kitRouter.patch('/:id/questions/:questionId', controller.patchQuestion);
kitRouter.patch('/:id/questions/:questionId/schedule', controller.shiftScheduleQuestion);
kitRouter.delete('/:id/questions/:questionId', controller.deleteQuestion);

kitRouter.post('/:id/regenerate-category', controller.regenerateCategory);
kitRouter.post('/:id/regenerate-schedule', controller.regenerateSchedule);

kitRouter.post('/:id/flashcards/reorder', controller.reorderFlashcards);
kitRouter.post('/:id/flashcards', controller.addFlashcard);
kitRouter.patch('/:id/flashcards/:flashcardId', controller.patchFlashcard);
kitRouter.patch('/:id/flashcards/:flashcardId/confidence', controller.patchConfidence);
kitRouter.delete('/:id/flashcards/:flashcardId', controller.deleteFlashcard);

kitRouter.patch('/:id/company-brief', controller.patchBrief);
kitRouter.post('/:id/regenerate-brief', controller.regenerateBrief);

kitRouter.get('/:id', controller.getKit);
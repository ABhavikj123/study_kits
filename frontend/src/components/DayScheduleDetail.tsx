'use client';

import { useState } from 'react';
import { Question } from '@/lib/types';
import { Plus } from 'lucide-react';

type DayScheduleDetailProps = {
  dayNumber: number;
  focus: string;
  minutes: number;
  totalDays: number;
  questions: Question[];
  isOpen: boolean;
  onClose: () => void;
  onShiftQuestion: (questionId: string, targetDay: number) => Promise<void>;
  onEditQuestion: (question: Question) => void;
  onDeleteQuestion: (questionId: string) => Promise<void>;
  onAddQuestion: () => void;
};

export function DayScheduleDetail({
  dayNumber,
  focus,
  minutes,
  totalDays,
  questions,
  isOpen,
  onClose,
  onShiftQuestion,
  onEditQuestion,
  onDeleteQuestion,
  onAddQuestion,
}: DayScheduleDetailProps) {
  const [shiftingId, setShiftingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleShift = async (questionId: string, targetDay: number) => {
    if (shiftingId) return;
    setShiftingId(questionId);
    try {
      await onShiftQuestion(questionId, targetDay);
    } finally {
      setShiftingId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex flex-col max-h-[90vh] w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between border-b border-zinc-200 pb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Schedule Detail
            </span>
            <h2 className="text-xl font-bold text-zinc-950 mt-0.5">
              Day {dayNumber}: {focus}
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Estimated duration: {minutes} mins · {questions.length} question
              {questions.length === 1 ? '' : 's'} assigned
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-950 font-bold"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {questions.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500 border border-dashed border-zinc-200 rounded">
              No questions assigned to this day.
            </p>
          ) : (
            questions.map((q) => (
              <article
                key={q.id}
                className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="rounded bg-zinc-200 px-2 py-0.5 font-medium text-zinc-800">
                      {q.category}
                    </span>
                    <span className="rounded bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-zinc-600">
                      Difficulty: {q.difficulty}
                    </span>
                    {q.requirement_ids.map((reqId) => (
                      <span
                        key={reqId}
                        className="rounded border border-zinc-300 bg-white px-2 py-0.5 font-mono"
                      >
                        {reqId}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <label className="text-zinc-500 font-medium">Shift to:</label>
                    <select
                      disabled={shiftingId === q.id}
                      value={dayNumber}
                      onChange={(e) => handleShift(q.id, Number(e.target.value))}
                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs outline-none disabled:opacity-50"
                    >
                      {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          Day {d} {d === dayNumber ? '(current)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-zinc-900 text-sm">{q.prompt}</h4>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-zinc-600 bg-white p-3 rounded border border-zinc-200">
                    {q.answer_outline}
                  </p>
                </div>

                <div className="flex justify-end gap-3 text-xs pt-1">
                  <button
                    onClick={() => onEditQuestion(q)}
                    className="underline text-zinc-700 hover:text-zinc-950 font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteQuestion(q.id)}
                    className="underline text-red-600 hover:text-red-800 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-200 pt-4">
          <button
            onClick={onAddQuestion}
            className="inline-flex items-center gap-1.5 rounded bg-zinc-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
          >
            <Plus size={14} aria-hidden="true" />
            Add question to day
          </button>

          <button
            onClick={onClose}
            className="rounded border border-zinc-300 px-4 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
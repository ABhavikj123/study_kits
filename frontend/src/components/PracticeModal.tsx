'use client';

import { useState } from 'react';
import { Flashcard } from '@/lib/types';
import { api } from '@/lib/api';
import { useNotification } from '@/context/NotificationContext';

export function PracticeModal({
  kitId,
  cards,
  onClose,
  onUpdated,
}: {
  kitId: string;
  cards: Flashcard[];
  onClose: () => void;
  onUpdated: (card: Flashcard) => void;
}) {
  const { notify } = useNotification();

  const [deck] = useState<Flashcard[]>(() =>
    [...cards].sort((a, b) => (a.confidence ?? 0) - (b.confidence ?? 0))
  );

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentCard = deck[index];

  const rate = async (confidence: 1 | 3 | 5) => {
    if (!currentCard || isSubmitting) return;

    setIsSubmitting(true);
    const targetCard = currentCard;

    setRevealed(false);
    setIndex((prev) => prev + 1);
    setReviewedCount((prev) => prev + 1);

    const updatedCard: Flashcard = { ...targetCard, confidence };
    onUpdated(updatedCard);

    try {
      await api(
        `/kits/${kitId}/flashcards/${targetCard.id}/confidence`,
        {
          method: 'PATCH',
          body: JSON.stringify({ confidence }),
        },
        0
      );
    } catch {
      notify(`Could not save confidence for: "${targetCard.front.slice(0, 25)}…"`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentCard) {
    const hardCount = cards.filter((c) => c.confidence === 1).length;
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950 p-5 text-white">
        <section className="w-full max-w-xl text-center">
          <p className="text-sm text-zinc-400">Session complete</p>
          <h2 className="mt-2 text-3xl font-semibold">{reviewedCount} cards reviewed</h2>
          <p className="mt-4 text-zinc-300">
            {hardCount} card{hardCount === 1 ? '' : 's'} marked hard. They will lead the next session.
          </p>
          <button
            onClick={onClose}
            className="mt-8 rounded bg-white px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-100"
          >
            Return to kit
          </button>
        </section>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-zinc-950 p-5 text-white"
    >
      <section className="w-full max-w-2xl">
        <div className="mb-5 flex justify-between text-sm text-zinc-400">
          <span>
            Practice · {index + 1} / {deck.length}
          </span>
          <button onClick={onClose} className="underline hover:text-white">
            Exit
          </button>
        </div>

        <div className="min-h-80 rounded-xl border border-zinc-700 bg-zinc-900 p-8 shadow-2xl">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            {revealed ? 'Answer' : 'Prompt'}
          </p>
          <p className="mt-6 whitespace-pre-wrap text-xl leading-relaxed">
            {revealed ? currentCard.back : currentCard.front}
          </p>
          <p className="mt-8 text-sm text-zinc-400">
            Requirements: {currentCard.requirement_ids.join(', ') || 'None'}
          </p>
        </div>

        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="mt-5 w-full rounded bg-white py-3 text-sm font-medium text-zinc-950 hover:bg-zinc-100"
          >
            Reveal answer
          </button>
        ) : (
          <div className="mt-5 grid grid-cols-3 gap-3">
            <button
              onClick={() => rate(1)}
              disabled={isSubmitting}
              className="rounded border border-zinc-600 py-3 text-sm transition-opacity hover:bg-zinc-800 disabled:opacity-50"
            >
              Hard
            </button>
            <button
              onClick={() => rate(3)}
              disabled={isSubmitting}
              className="rounded border border-zinc-600 py-3 text-sm transition-opacity hover:bg-zinc-800 disabled:opacity-50"
            >
              Medium
            </button>
            <button
              onClick={() => rate(5)}
              disabled={isSubmitting}
              className="rounded bg-white py-3 text-sm font-medium text-zinc-950 transition-opacity hover:bg-zinc-100 disabled:opacity-50"
            >
              Easy
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
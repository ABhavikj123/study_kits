'use client';

import { X } from 'lucide-react';
import { useState } from 'react';

type FlashcardModalProps = {
  initialFront?: string;
  initialBack?: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { front: string; back: string }) => Promise<void>;
};

export function FlashcardModal({
  initialFront = '',
  initialBack = '',
  title,
  isOpen,
  onClose,
  onSave,
}: FlashcardModalProps) {
  const [front, setFront] = useState(initialFront);
  const [back, setBack] = useState(initialBack);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSave({ front: front.trim(), back: back.trim() });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center text-zinc-500 hover:text-zinc-800 disabled:opacity-50"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Front (Prompt)
            </label>
            <textarea
              required
              rows={3}
              value={front}
              onChange={(e) => setFront(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-300 p-2.5 text-sm outline-none focus:border-zinc-950"
              placeholder="e.g. What is React reconciliation?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Back (Answer)
            </label>
            <textarea
              required
              rows={4}
              value={back}
              onChange={(e) => setBack(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-300 p-2.5 text-sm outline-none focus:border-zinc-950"
              placeholder="e.g. The algorithm React uses to diff one tree with another..."
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
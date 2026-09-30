'use client';

import { ChevronDown, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type QuestionModalProps = {
  initialPrompt?: string;
  initialOutline?: string;
  initialCategory?: string;
  initialDifficulty?: 1 | 2 | 3;
  availableCategories: string[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    prompt: string;
    answer_outline: string;
    category: string;
    difficulty: 1 | 2 | 3;
  }) => Promise<void>;
};

export function QuestionModal({
  initialPrompt = '',
  initialOutline = '',
  initialCategory = '',
  initialDifficulty = 2,
  availableCategories,
  isOpen,
  onClose,
  onSave,
}: QuestionModalProps) {
  const [category, setCategory] = useState(
    initialCategory || availableCategories[0] || 'technical'
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [prompt, setPrompt] = useState(initialPrompt);
  const [outline, setOutline] = useState(initialOutline);
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(initialDifficulty);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  if (!isOpen) return null;

  const filteredCategories = availableCategories.filter((cat) =>
    cat.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleSelectExisting = (cat: string) => {
    setCategory(cat);
    setIsCreatingNew(false);
    setDropdownOpen(false);
    setSearchFilter('');
  };

  const handleStartCreateNew = () => {
    setIsCreatingNew(true);
    setDropdownOpen(false);
    setSearchFilter('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = isCreatingNew ? newCategoryName.trim() : category.trim();

    if (!finalCategory || !prompt.trim() || !outline.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        prompt: prompt.trim(),
        answer_outline: outline.trim(),
        category: finalCategory,
        difficulty,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 overflow-y-auto"
    >
      <form
        onSubmit={handleSubmit}
        className="flex flex-col max-h-[90vh] w-full max-w-xl rounded-xl bg-white shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">
            {initialPrompt ? 'Edit Question' : 'Add Question'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center text-zinc-400 hover:text-zinc-700 disabled:opacity-50"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div ref={dropdownRef} className="relative">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600">
              Category
            </label>

            {!isCreatingNew ? (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-left text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-950"
                >
                  <span className="truncate font-medium">{category}</span>
                  <ChevronDown
                    size={16}
                    className="ml-2 shrink-0 text-zinc-400"
                    aria-hidden="true"
                  />
                </button>

                {dropdownOpen && (
                  <div className="absolute left-0 right-0 z-50 mt-1 rounded-lg border border-zinc-200 bg-white shadow-xl">
                    <div className="p-2 border-b border-zinc-100">
                      <input
                        type="text"
                        autoFocus
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        placeholder="Search category..."
                        className="w-full rounded border border-zinc-200 px-2.5 py-1.5 text-xs outline-none focus:border-zinc-900"
                      />
                    </div>

                    <div className="max-h-52 overflow-y-auto p-1 text-sm space-y-0.5">
                      <button
                        type="button"
                        onClick={handleStartCreateNew}
                        className="flex w-full items-center gap-1.5 rounded px-3 py-2 text-left text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                      >
                        <span>+</span> Create new category…
                      </button>

                      <div className="h-px bg-zinc-100 my-1" />

                      {filteredCategories.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-zinc-400">No matching category</p>
                      ) : (
                        filteredCategories.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => handleSelectExisting(cat)}
                            className={`w-full rounded px-3 py-2 text-left text-xs transition-colors ${cat === category
                              ? 'bg-zinc-950 font-semibold text-white'
                              : 'text-zinc-700 hover:bg-zinc-100'
                              }`}
                          >
                            {cat}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  required
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Enter new category name..."
                  className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950"
                />
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="rounded border border-zinc-300 px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600">
              Difficulty
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value) as 1 | 2 | 3)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-950"
            >
              <option value={1}>1 - Introductory</option>
              <option value={2}>2 - Intermediate</option>
              <option value={3}>3 - Advanced</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600">
              Question Prompt
            </label>
            <textarea
              required
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 p-3 text-sm outline-none focus:border-zinc-950"
              placeholder="Enter question prompt..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600">
              Answer Outline
            </label>
            <textarea
              required
              rows={4}
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 p-3 text-sm outline-none focus:border-zinc-950"
              placeholder="Outline ideal evaluation points..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-zinc-950 px-5 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
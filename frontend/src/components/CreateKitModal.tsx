'use client';

import { FormEvent, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useNotification } from '@/context/NotificationContext';
import { X } from 'lucide-react';

export function CreateKitModal({
  onCreated,
  onClose,
}: {
  onCreated: (id: string) => void;
  onClose: () => void;
}) {
  const [jobDescription, setJobDescription] = useState('');
  const [companyUrl, setCompanyUrl] = useState('');
  const [days, setDays] = useState(7);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { notify } = useNotification();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    if (!jobDescription.trim() || !companyUrl.trim() || days < 1 || days > 60) {
      setError('Provide a job description, company URL, and 1–60 days.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const result = await api<{ kitId: string }>(
        '/kits',
        {
          method: 'POST',
          body: JSON.stringify({ jobDescription, companyUrl, days }),
        },
        0
      );
      onCreated(result.kitId);
      onClose();
    } catch (cause) {
      const message =
        cause instanceof ApiError ? cause.message : 'Unable to create the kit.';
      setError(message);
      notify(message);
      setSubmitting(false); // Only re-enable on failure so the user can fix errors and try again
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-kit-heading"
      className="fixed inset-0 z-40 grid place-items-center bg-black/35 p-4"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="create-kit-heading" className="text-lg font-semibold">
              Create preparation kit
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              The role description is processed directly; the company site is
              researched separately.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center text-zinc-500 hover:text-zinc-900 disabled:opacity-40"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        )}

        <label className="mt-5 block text-sm font-medium">
          Job description
          <textarea
            required
            disabled={submitting}
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            rows={9}
            className="mt-1 w-full resize-y rounded border border-zinc-300 p-3 outline-none focus:border-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-500"
          />
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_140px]">
          <label className="block text-sm font-medium">
            Company website
            <input
              required
              disabled={submitting}
              type="url"
              placeholder="https://example.com"
              value={companyUrl}
              onChange={(event) => setCompanyUrl(event.target.value)}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-500"
            />
          </label>

          <label className="block text-sm font-medium">
            Days available
            <input
              required
              disabled={submitting}
              min={1}
              max={60}
              type="number"
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-500"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded border border-zinc-300 px-4 py-2 text-sm disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            disabled={submitting}
            className="rounded bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'Starting…' : 'Create kit'}
          </button>
        </div>
      </form>
    </div>
  );
}
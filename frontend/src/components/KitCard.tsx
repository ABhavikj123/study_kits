'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, streamUrl } from '@/lib/api';
import { useNotification } from '@/context/NotificationContext';

export type Kit = {
  _id: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  error?: { message?: string };
  source?: { company?: string };
  role?: { title?: string };
  schedule?: { days_available?: number };
  input?: { companyUrl?: string; days?: number };
};

export function KitCard({
  kit,
  onChanged,
  onDeleted,
}: {
  kit: Kit;
  onChanged: (kit: Kit) => void;
  onDeleted: (id: string) => void;
}) {
  const router = useRouter();
  const { notify } = useNotification();
  const [message, setMessage] = useState('Starting generation…');
  const [actionInProgress, setActionInProgress] = useState(false);
  const source = useRef<EventSource | null>(null);

  useEffect(() => {
    if (kit.status !== 'pending') return;

    const events = new EventSource(streamUrl(kit._id), {
      withCredentials: true,
    });
    source.current = events;

    const update = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        setMessage(data.message || message);
        if (['complete', 'failed', 'cancelled'].includes(data.type)) {
          events.close();
          api<Kit>(`/kits/${kit._id}`, {}, 0)
            .then(onChanged)
            .catch(() => {});
        }
      } catch {}
    };

    ['progress', 'complete', 'failed', 'cancelled'].forEach((name) =>
      events.addEventListener(name, update)
    );

    events.onerror = () => {
      events.close();
      api<Kit>(`/kits/${kit._id}`, {}, 0)
        .then(onChanged)
        .catch(() => {});
    };

    return () => events.close();
  }, [kit._id, kit.status, onChanged]);

  const cancel = async () => {
    if (actionInProgress) return;
    setActionInProgress(true);
    try {
      const result = await api<{ status: Kit['status'] }>(
        `/kits/${kit._id}/cancel`,
        { method: 'POST' },
        0
      );
      onChanged({ ...kit, status: result.status });
    } catch {
      notify('Could not cancel this generation.');
    } finally {
      setActionInProgress(false);
    }
  };

  const remove = async () => {
    if (actionInProgress) return;
    if (!window.confirm('Delete this kit? This cannot be undone.')) return;
    setActionInProgress(true);
    onDeleted(kit._id);
    try {
      await api<void>(`/kits/${kit._id}`, { method: 'DELETE' }, 0);
    } catch {
      notify('Could not delete kit. Refreshing list is recommended.');
      setActionInProgress(false);
    }
  };

  const company = kit.source?.company || kit.input?.companyUrl || 'New preparation kit';
  const title = kit.role?.title || 'Extracting role';
  const days = kit.schedule?.days_available || kit.input?.days;

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">{company}</p>
          <h2 className="mt-1 font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-zinc-500">
            {days ? `${days} study day${days === 1 ? '' : 's'} · ` : ''}
            {new Date(kit.createdAt).toLocaleDateString()}
          </p>
        </div>
        <button
          aria-label="Delete kit"
          disabled={actionInProgress}
          onClick={remove}
          className="text-sm text-zinc-500 underline hover:text-zinc-950 disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      {kit.status === 'completed' && (
        <div className="mt-5 flex items-center justify-between">
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium">
            Ready
          </span>
          <button
            onClick={() => router.push(`/kits/${kit._id}`)}
            className="rounded bg-zinc-950 px-3 py-2 text-sm font-medium text-white"
          >
            Open kit
          </button>
        </div>
      )}

      {kit.status === 'pending' && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-zinc-600">{message}</span>
            <button
              onClick={cancel}
              disabled={actionInProgress}
              className="underline disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          <div className="h-1 overflow-hidden rounded bg-zinc-200">
            <div className="h-full w-2/3 animate-pulse rounded bg-zinc-900" />
          </div>
        </div>
      )}

      {kit.status === 'failed' && (
        <p className="mt-5 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Failed: {kit.error?.message || 'Generation could not complete.'}
        </p>
      )}

      {kit.status === 'cancelled' && (
        <p className="mt-5 text-sm text-zinc-500">Generation cancelled.</p>
      )}
    </article>
  );
}
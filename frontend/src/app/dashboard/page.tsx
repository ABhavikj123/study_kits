'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { CreateKitModal } from '@/components/CreateKitModal';
import { Kit, KitCard } from '@/components/KitCard';
import { ProtectedRoute } from '@/components/ProtectedRoute';

function Dashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { notify } = useNotification();
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(
    () =>
      api<{ kits: Kit[] }>('/kits')
        .then((result) => setKits(result.kits))
        .catch(() => notify('Could not load your kits.'))
        .finally(() => setLoading(false)),
    [notify]
  );

  useEffect(() => {
    load();
  }, [load]);

  const changed = useCallback(
    (kit: Kit) =>
      setKits((items) =>
        items.map((item) => (item._id === kit._id ? kit : item))
      ),
    []
  );

  const created = useCallback(
    (id: string) => {
      api<Kit>(`/kits/${id}`, {}, 0)
        .then((kit) => setKits((items) => [kit, ...items]))
        .catch(() => load());
    },
    [load]
  );

  const signOut = async () => {
    try {
      await logout();
      router.replace('/login');
    } catch {
      notify('Could not sign out.');
    }
  };

  return (
    <main className="min-h-screen bg-zinc-100">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div>
            <a href="/dashboard" className="font-semibold tracking-tight">
              AI Interview Prep Kit
            </a>
            <p className="text-xs text-zinc-500">{user?.email}</p>
          </div>
          <button onClick={signOut} className="text-sm underline">
            Log out
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Your preparation kits
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Track each role independently and return when the draft is ready.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="rounded bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white"
          >
            Create new kit
          </button>
        </div>

        {loading ? (
          <p className="py-16 text-sm text-zinc-500">Loading kits…</p>
        ) : kits.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center">
            <h2 className="font-medium">No kits yet</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Start with a job description, company site, and the time you have
              available.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-5 text-sm font-medium underline"
            >
              Create your first kit
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {kits.map((kit) => (
              <KitCard
                key={kit._id}
                kit={kit}
                onChanged={changed}
                onDeleted={(id) =>
                  setKits((items) => items.filter((item) => item._id !== id))
                }
              />
            ))}
          </div>
        )}
      </section>

      {showModal && (
        <CreateKitModal
          onClose={() => setShowModal(false)}
          onCreated={created}
        />
      )}
    </main>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}
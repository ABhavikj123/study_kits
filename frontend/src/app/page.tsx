'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) router.replace(isAuthenticated ? '/dashboard' : '/login');
  }, [loading, isAuthenticated, router]);

  return (
    <main className="grid min-h-screen place-items-center text-sm text-zinc-500">
      Loading…
    </main>
  );
}
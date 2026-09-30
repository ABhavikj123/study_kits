'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { login, register, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) router.replace('/dashboard');
  }, [loading, isAuthenticated, router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    setError('');
    setSubmitting(true);

    try {
      await (mode === 'login' ? login(email, password) : register(email, password));
      router.replace('/dashboard');
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Unable to reach the service. Try again.'
      );
      setSubmitting(false); 
    }
  };

  const title = mode === 'login' ? 'Sign in' : 'Create account';

  return (
    <main className="grid min-h-screen place-items-center bg-zinc-100 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-7 shadow-sm"
      >
        <p className="mb-1 text-sm text-zinc-500">AI Interview Prep Kit</p>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h1>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        <label className="block text-sm font-medium">
          Email
          <input
            autoComplete="email"
            type="email"
            required
            disabled={submitting}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-500"
          />
        </label>

        <label className="mt-4 block text-sm font-medium">
          Password
          <input
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={8}
            type="password"
            required
            disabled={submitting}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-500"
          />
        </label>

        <button
          disabled={submitting}
          className="mt-6 w-full rounded bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Please wait…' : title}
        </button>

        <p className="mt-4 text-center text-sm text-zinc-600">
          {mode === 'login' ? (
            <>
              New here?{' '}
              <a
                className={`underline ${submitting ? 'pointer-events-none opacity-50' : ''}`}
                href="/register"
              >
                Create an account
              </a>
            </>
          ) : (
            <>
              Already registered?{' '}
              <a
                className={`underline ${submitting ? 'pointer-events-none opacity-50' : ''}`}
                href="/login"
              >
                Sign in
              </a>
            </>
          )}
        </p>
      </form>
    </main>
  );
}
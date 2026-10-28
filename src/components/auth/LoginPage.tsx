'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { BrandMark } from '@/components/brand/BrandMark';
import { completeNewPassword, isAuthConfigured, signInWithPassword } from '@/lib/auth/cognito';

/** Where to go after signing in: a path inside this app, else the workflow list. */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login')
    ? next
    : '/workflows';
}

/** Cognito's error, in words for the person signing in. */
function describe(error: unknown): string {
  const name = (error as { name?: string })?.name ?? '';
  if (name === 'NotAuthorizedException' || name === 'UserNotFoundException')
    return 'Incorrect email or password.';
  if (name === 'PasswordResetRequiredException') return 'Your password must be reset. Ask an administrator.';
  if (name === 'UserNotConfirmedException') return 'This account is not confirmed yet. Ask an administrator.';
  if (name === 'InvalidPasswordException')
    return 'That password does not meet the rules: at least 12 characters, with upper and lower case letters and a number.';
  if (name === 'LimitExceededException' || name === 'TooManyRequestsException')
    return 'Too many attempts. Wait a minute and try again.';
  return (error as Error)?.message || 'Sign-in failed. Try again.';
}

/**
 * Sign-in to the Agent Workflow Builder, with the builder's own accounts (not the
 * Strands Visual Builder's). After signing in, the user returns to the page they
 * came from (`?next=`), else the workflow list.
 */
export function LoginPage() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const { status, refresh } = useAuth();

  const [step, setStep] = useState<'password' | 'newPassword'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === 'signedIn') router.replace(next);
  }, [next, router, status]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (step === 'newPassword' && newPassword !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const result =
        step === 'password' ? await signInWithPassword(email, password) : await completeNewPassword(newPassword);
      if (result.status === 'newPasswordRequired') {
        setStep('newPassword');
      } else {
        await refresh();
        router.replace(next);
      }
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-[var(--header-h)] shrink-0 items-center gap-3 border-b border-border bg-panel px-3">
        <BrandMark />
        <span className="text-[13px] font-semibold text-text-primary">Agent Workflow Builder</span>
      </header>

      <main className="grid flex-1 place-items-center px-4 py-10">
        <form
          onSubmit={submit}
          className="w-full max-w-sm rounded-xl border border-border bg-panel p-6 shadow-lg"
          aria-labelledby="login-title"
          noValidate
        >
          <h1 id="login-title" className="text-lg font-semibold text-text-primary">
            {step === 'password' ? 'Sign in' : 'Choose a new password'}
          </h1>
          <p className="mt-1 text-[12px] text-text-muted">
            {step === 'password'
              ? 'Use your Agent Workflow Builder account. Strands Visual Builder accounts do not work here.'
              : 'Your account has a temporary password. Choose your own to finish signing in.'}
          </p>

          {!isAuthConfigured() && (
            <p className="mt-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[12px] text-warning" role="alert">
              Sign-in is not configured: set NEXT_PUBLIC_COGNITO_USER_POOL_ID and NEXT_PUBLIC_COGNITO_CLIENT_ID, then
              rebuild the UI.
            </p>
          )}

          {step === 'password' ? (
            <>
              <label className="prop-label mt-5 block" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                className="prop-input mt-1 w-full"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoFocus
              />
              <label className="prop-label mt-4 block" htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                className="prop-input mt-1 w-full"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </>
          ) : (
            <>
              <label className="prop-label mt-5 block" htmlFor="login-new-password">
                New password
              </label>
              <input
                id="login-new-password"
                type="password"
                autoComplete="new-password"
                className="prop-input mt-1 w-full"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                autoFocus
              />
              <label className="prop-label mt-4 block" htmlFor="login-confirm">
                Confirm the new password
              </label>
              <input
                id="login-confirm"
                type="password"
                autoComplete="new-password"
                className="prop-input mt-1 w-full"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
            </>
          )}

          {error && (
            <p className="mt-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary mt-5 w-full justify-center disabled:opacity-50"
            disabled={
              busy ||
              !isAuthConfigured() ||
              (step === 'password' ? !email || !password : !newPassword || !confirm)
            }
          >
            {busy ? 'Signing in…' : step === 'password' ? 'Sign in' : 'Set password and sign in'}
          </button>
        </form>
      </main>
    </div>
  );
}

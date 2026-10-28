'use client';

import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { AUTH_EXPIRED_EVENT } from '@/lib/api/client';
import { currentUser, isAuthConfigured, signOutUser, type SignedInUser } from '@/lib/auth/cognito';

type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

interface AuthState {
  status: AuthStatus;
  user: SignedInUser | null;
  /** Reads the session again (after a sign-in). */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (!state) throw new Error('useAuth needs an AuthProvider');
  return state;
}

/** Who is signed in, for the whole app. The API reporting 401 signs the user out. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<SignedInUser | null>(null);

  const refresh = useCallback(async () => {
    const signedIn = await currentUser();
    setUser(signedIn);
    setStatus(signedIn ? 'signedIn' : 'signedOut');
  }, []);

  const signOut = useCallback(async () => {
    await signOutUser().catch(() => undefined);
    // Another user's workflows must not stay in the cache.
    queryClient.clear();
    setUser(null);
    setStatus('signedOut');
  }, [queryClient]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const expired = () => {
      setUser(null);
      setStatus('signedOut');
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, expired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, expired);
  }, []);

  const value = useMemo(() => ({ status, user, refresh, signOut }), [refresh, signOut, status, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** The login page's address, coming back to `next` (a path in this app) afterwards. */
export const loginHref = (next: string) => `/login?next=${encodeURIComponent(next)}`;

function Centered({ children }: { children: ReactNode }) {
  return <div className="grid min-h-screen place-items-center p-8 text-center">{children}</div>;
}

/** Shows its children to a signed-in user; anyone else goes to the login page and back. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const here = `${pathname}${searchParams.size > 0 ? `?${searchParams.toString()}` : ''}`;

  useEffect(() => {
    if (status === 'signedOut' && isAuthConfigured()) router.replace(loginHref(here));
  }, [here, router, status]);

  if (!isAuthConfigured()) {
    return (
      <Centered>
        <div className="max-w-md">
          <i className="bi-shield-lock text-4xl text-warning" />
          <h1 className="mt-3 text-lg font-semibold text-text-primary">Sign-in is not configured</h1>
          <p className="mt-1 text-[13px] text-text-muted">
            Set NEXT_PUBLIC_COGNITO_USER_POOL_ID and NEXT_PUBLIC_COGNITO_CLIENT_ID (run
            scripts/create-user-pool.sh in the server repository), then rebuild the UI.
          </p>
        </div>
      </Centered>
    );
  }
  if (status !== 'signedIn') {
    return (
      <Centered>
        <p className="text-[13px] text-text-muted" role="status">
          {status === 'loading' ? 'Checking your sign-in…' : 'Redirecting to sign-in…'}
        </p>
      </Centered>
    );
  }
  return <>{children}</>;
}

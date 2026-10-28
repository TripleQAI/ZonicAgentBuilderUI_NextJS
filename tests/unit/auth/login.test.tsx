import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, RequireAuth } from '@/components/auth/AuthProvider';
import { LoginPage, safeNext } from '@/components/auth/LoginPage';
import { api, AUTH_EXPIRED_EVENT } from '@/lib/api/client';

/**
 * Sign-in with the builder's own accounts: the login page, the guard on the
 * pages, and the API client sending the token. Cognito is mocked.
 */

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/builder',
  useSearchParams: () => search,
}));

const cognito = vi.hoisted(() => ({
  signedIn: null as { email: string } | null,
  token: null as string | null,
  signInWithPassword: vi.fn(),
  completeNewPassword: vi.fn(),
}));
vi.mock('@/lib/auth/cognito', () => ({
  currentUser: async () => cognito.signedIn,
  idToken: async () => cognito.token,
  isAuthConfigured: () => true,
  signOutUser: async () => undefined,
  signInWithPassword: cognito.signInWithPassword,
  completeNewPassword: cognito.completeNewPassword,
}));

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>,
  );
}

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  replace.mockReset();
  search = new URLSearchParams();
  cognito.signedIn = null;
  cognito.token = null;
  cognito.signInWithPassword.mockReset();
  cognito.completeNewPassword.mockReset();
  vi.unstubAllGlobals();
});

describe('the login page', () => {
  it('signs in and goes back to the page the user came from', async () => {
    search = new URLSearchParams({ next: '/builder?id=wf-1' });
    cognito.signInWithPassword.mockImplementation(async () => {
      cognito.signedIn = { email: 'me@example.com' };
      return { status: 'signedIn' };
    });
    wrap(<LoginPage />);
    expect(screen.getByText(/Strands Visual Builder accounts do not work here/)).toBeInTheDocument();
    fill('Email', 'me@example.com');
    fill('Password', 'Secret-password-1');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/builder?id=wf-1'));
    expect(cognito.signInWithPassword).toHaveBeenCalledWith('me@example.com', 'Secret-password-1');
  });

  it('says so when the email or password is wrong', async () => {
    cognito.signInWithPassword.mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAuthorizedException' }));
    wrap(<LoginPage />);
    fill('Email', 'me@example.com');
    fill('Password', 'wrong');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
    expect(replace).not.toHaveBeenCalled();
  });

  it('asks a user with a temporary password to choose a new one', async () => {
    cognito.signInWithPassword.mockResolvedValue({ status: 'newPasswordRequired' });
    cognito.completeNewPassword.mockImplementation(async () => {
      cognito.signedIn = { email: 'me@example.com' };
      return { status: 'signedIn' };
    });
    wrap(<LoginPage />);
    fill('Email', 'me@example.com');
    fill('Password', 'Temporary-1');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument();
    fill('New password', 'My-own-password-1');
    fill('Confirm the new password', 'Something-else-1');
    fireEvent.click(screen.getByRole('button', { name: 'Set password and sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The two passwords do not match.');
    fill('Confirm the new password', 'My-own-password-1');
    fireEvent.click(screen.getByRole('button', { name: 'Set password and sign in' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/workflows'));
    expect(cognito.completeNewPassword).toHaveBeenCalledWith('My-own-password-1');
  });

  it('only returns to paths inside the app', () => {
    expect(safeNext('/builder?id=1')).toBe('/builder?id=1');
    expect(safeNext('https://evil.example')).toBe('/workflows');
    expect(safeNext('//evil.example')).toBe('/workflows');
    expect(safeNext('/login')).toBe('/workflows');
    expect(safeNext(null)).toBe('/workflows');
  });
});

describe('the sign-in guard', () => {
  it('sends a signed-out visitor to the login page, coming back afterwards', async () => {
    search = new URLSearchParams({ id: 'wf-1' });
    wrap(
      <RequireAuth>
        <p>the builder</p>
      </RequireAuth>,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?next=%2Fbuilder%3Fid%3Dwf-1'));
    expect(screen.queryByText('the builder')).toBeNull();
  });

  it('shows the page to a signed-in user', async () => {
    cognito.signedIn = { email: 'me@example.com' };
    wrap(
      <RequireAuth>
        <p>the builder</p>
      </RequireAuth>,
    );
    expect(await screen.findByText('the builder')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('the API client', () => {
  it('sends the ID token, and a 401 ends the session', async () => {
    cognito.token = 'id-token-1';
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
      new Response(JSON.stringify({ error: 'Sign-in required.', code: 'unauthorized' }), { status: 401 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const expired = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, expired);
    await expect(api.listAgents()).rejects.toMatchObject({ status: 401 });
    const init = fetchMock.mock.calls[0]![1]!;
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer id-token-1');
    expect(expired).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_EXPIRED_EVENT, expired);
  });
});

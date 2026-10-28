/**
 * Sign-in against the builder's own Cognito user pool (separate from the Strands
 * Visual Builder's). The browser signs in with SRP, so the password never leaves
 * it; the ID token goes to the API as a bearer token (lib/api/client.ts).
 *
 * The pool and app client IDs are public values, read from NEXT_PUBLIC_COGNITO_*
 * at build time (scripts/create-user-pool.sh in the server repository writes them).
 */

'use client';

import { Amplify } from 'aws-amplify';
import {
  confirmSignIn,
  fetchAuthSession,
  fetchUserAttributes,
  getCurrentUser,
  signIn,
  signOut,
} from 'aws-amplify/auth';

export const authConfig = {
  region: process.env.NEXT_PUBLIC_COGNITO_REGION ?? 'us-east-1',
  userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? '',
  clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? '',
};

export const isAuthConfigured = () => authConfig.userPoolId !== '' && authConfig.clientId !== '';

let configured = false;

function configure(): void {
  if (configured || !isAuthConfigured()) return;
  Amplify.configure({
    Auth: { Cognito: { userPoolId: authConfig.userPoolId, userPoolClientId: authConfig.clientId } },
  });
  configured = true;
}

export interface SignedInUser {
  email: string;
}

/** What a sign-in attempt needs next: nothing (signed in), or a new password. */
export type SignInResult = { status: 'signedIn' } | { status: 'newPasswordRequired' };

/** The signed-in user, or null. */
export async function currentUser(): Promise<SignedInUser | null> {
  if (!isAuthConfigured()) return null;
  configure();
  try {
    const user = await getCurrentUser();
    const attributes = await fetchUserAttributes().catch(() => ({}) as Record<string, string>);
    return { email: attributes.email ?? user.signInDetails?.loginId ?? user.username };
  } catch {
    return null;
  }
}

export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  configure();
  const result = await signIn({ username: email.trim(), password });
  return nextStep(result.nextStep.signInStep);
}

/** Answers the "choose a new password" step of a user created with a temporary one. */
export async function completeNewPassword(password: string): Promise<SignInResult> {
  configure();
  const result = await confirmSignIn({ challengeResponse: password });
  return nextStep(result.nextStep.signInStep);
}

function nextStep(step: string): SignInResult {
  if (step === 'DONE') return { status: 'signedIn' };
  if (step === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') return { status: 'newPasswordRequired' };
  throw new Error('This account needs a sign-in step the builder does not support. Ask an administrator.');
}

export async function signOutUser(): Promise<void> {
  configure();
  await signOut();
}

/** The current ID token (refreshed when it has expired), or null when signed out. */
export async function idToken(): Promise<string | null> {
  if (!isAuthConfigured()) return null;
  configure();
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? null;
  } catch {
    return null;
  }
}

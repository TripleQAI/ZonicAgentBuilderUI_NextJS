import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LoginPage } from '@/components/auth/LoginPage';

export const metadata: Metadata = { title: 'Sign in · TripleQ Agent Workflow Builder' };

/** Sign-in with the builder's own accounts; `?next=` is where to go afterwards. */
export default function Login() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}

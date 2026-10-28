import { Suspense } from 'react';

import { RequireAuth } from '@/components/auth/AuthProvider';
import { BuilderShell } from '@/components/layout/BuilderShell';

/**
 * The builder is one client-heavy route. The App Router provides the shell and
 * routing; the editor itself is a client component tree. `?id=` opens a workflow
 * and `?new=1` a blank one; reading them needs a Suspense boundary. Signed-in
 * users only: anyone else goes to /login and comes back.
 */
export default function BuilderPage() {
  return (
    <Suspense>
      <RequireAuth>
        <BuilderShell />
      </RequireAuth>
    </Suspense>
  );
}

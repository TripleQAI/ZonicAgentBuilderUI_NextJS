import { Suspense } from 'react';

import { BuilderShell } from '@/components/layout/BuilderShell';

/**
 * The builder is one client-heavy route. The App Router provides the shell and
 * routing; the editor itself is a client component tree. `?id=` opens a workflow
 * and `?new=1` a blank one; reading them needs a Suspense boundary.
 */
export default function BuilderPage() {
  return (
    <Suspense>
      <BuilderShell />
    </Suspense>
  );
}

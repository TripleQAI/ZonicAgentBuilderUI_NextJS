import { BuilderShell } from '@/components/layout/BuilderShell';

/**
 * The builder is one client-heavy route. The App Router provides the shell and
 * routing; the editor itself is a client component tree.
 */
export default function BuilderPage() {
  return <BuilderShell />;
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/components/auth/AuthProvider';
import { AppHeader } from '@/components/layout/AppHeader';
import { useWorkflowStore } from '@/store/useWorkflowStore';

/** The builder header's way back to the workflow list, which guards unsaved changes. */

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/lib/auth/cognito', () => ({
  currentUser: async () => ({ email: 'builder@example.com' }),
  idToken: async () => 'test-token',
  isAuthConfigured: () => true,
  signOutUser: async () => undefined,
}));

function renderHeader() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <AppHeader onOpenDialog={vi.fn()} onSave={vi.fn()} agents={[]} onOpenAgent={vi.fn()} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return screen.getByRole('link', { name: 'Back to all workflows' });
}

/**
 * Clicks the link and reports whether its navigation went ahead (the header's
 * handler did not stop it). The navigation itself is then stopped: jsdom has none.
 */
function click(link: HTMLElement): boolean {
  let allowed = false;
  const record = (event: Event) => {
    allowed = !event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener('click', record);
  fireEvent(link, createEvent.click(link, { button: 0 }));
  document.removeEventListener('click', record);
  return allowed;
}

afterEach(() => vi.restoreAllMocks());

describe('back to the workflow list', () => {
  it('is one click away from the builder', () => {
    const link = renderHeader();
    expect(link).toHaveAttribute('href', '/workflows');
    expect(link).toHaveTextContent('Workflows');
  });

  it('goes straight back when everything is saved', () => {
    useWorkflowStore.setState({ isDirty: false });
    const confirm = vi.spyOn(window, 'confirm');
    expect(click(renderHeader())).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks first when there are unsaved changes, and stays if the user says no', () => {
    useWorkflowStore.setState({ isDirty: true });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(click(renderHeader())).toBe(false);
    expect(confirm).toHaveBeenCalledWith('This workflow has unsaved changes. Leave without saving?');
  });

  it('leaves when the user confirms', () => {
    useWorkflowStore.setState({ isDirty: true });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    expect(click(renderHeader())).toBe(true);
  });
});

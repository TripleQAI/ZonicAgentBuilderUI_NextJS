'use client';

import { useRouter } from 'next/navigation';

import { useAuth } from '@/components/auth/AuthProvider';

/** The signed-in user's email and Sign out, at the right of a page header. */
export function UserMenu() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  if (!user) return null;
  return (
    <div className="flex shrink-0 items-center gap-2 text-[12px] text-text-muted">
      <i className="bi-person-circle text-[14px]" aria-hidden />
      <span className="max-w-[220px] truncate" title={user.email}>
        {user.email}
      </span>
      <button
        type="button"
        className="btn-sm"
        onClick={async () => {
          await signOut();
          router.replace('/login');
        }}
      >
        <i className="bi-box-arrow-right" aria-hidden /> Sign out
      </button>
    </div>
  );
}

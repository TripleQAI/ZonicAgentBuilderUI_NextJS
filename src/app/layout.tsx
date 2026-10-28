import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Providers } from '@/app/providers';

import 'bootstrap-icons/font/bootstrap-icons.css';
import '@xyflow/react/dist/style.css';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'TripleQ Agent Workflow Builder',
  description: 'Visual orchestration editor for multi-agent AI workflows.',
  icons: { icon: '/favicon.png' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

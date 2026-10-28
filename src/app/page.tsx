import { redirect } from 'next/navigation';

/** The landing page is the list of agent workflows; each one opens in the builder. */
export default function Home() {
  redirect('/workflows');
}

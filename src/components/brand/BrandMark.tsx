import Image from 'next/image';
import Link from 'next/link';

/**
 * The TripleQ AI mark as the welcome site and the runtime UI draw it: the logo
 * icon and the wordmark, with the Q bold in the accent. It links to the list of
 * agent workflows.
 */
export function BrandMark() {
  return (
    <Link
      href="/workflows"
      className="flex shrink-0 items-center gap-2 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      aria-label="TripleQ AI — all agent workflows"
      title="All agent workflows"
    >
      <Image src="/tripleq-logo.png" alt="" width={73} height={71} priority className="h-7 w-auto" />
      <span aria-hidden className="flex gap-[0.3em] text-[15px] tracking-wide text-text-primary">
        <span className="font-light">TRIPLE</span>
        <span className="font-bold text-accent">Q</span>
        <span className="font-light">AI</span>
      </span>
    </Link>
  );
}

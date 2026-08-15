/** Read a dot-path (`config.model`) out of an object. */
export function getDotPath(source: unknown, dotPath: string): unknown {
  let cursor: unknown = source;
  for (const key of dotPath.split('.')) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

/** Write a dot-path into an object, creating intermediate objects. */
export function setDotPath(
  target: Record<string, unknown>,
  dotPath: string,
  value: unknown,
): void {
  const keys = dotPath.split('.');
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (cursor[key] == null || typeof cursor[key] !== 'object') cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
}

/** Parse a single explicit HTTP(S) origin without paths, credentials or wildcards. */
export function parseHttpOrigin(value: string): string {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.hostname.includes('*')
  ) {
    throw new Error('Expected an explicit HTTP(S) origin.');
  }
  return url.origin;
}

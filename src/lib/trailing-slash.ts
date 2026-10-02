// Public pages are canonical with a trailing slash (canonical tags, sitemap,
// internal links). Requests without it get a permanent redirect, so search
// engines only ever see one version of each page. Private areas, API calls,
// server functions and static files are left untouched.
const privatePrefixes = ['/portal', '/admin', '/auth', '/reset-password', '/i', '/api', '/_', '/.netlify']

export function canonicalTrailingSlashPath(pathname: string): string | null {
  if (pathname === '/' || pathname.endsWith('/')) return null
  if (/\.[a-z0-9]+$/i.test(pathname)) return null
  if (privatePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || (prefix.endsWith('_') && pathname.startsWith(prefix)))) return null
  return `${pathname}/`
}

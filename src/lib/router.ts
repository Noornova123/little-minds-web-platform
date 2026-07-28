import { useEffect, useState } from 'react';

// Path-based router using the History API. A hash fallback is kept only for
// the very first load so a deep link like /admin/bootstrap works whether the
// user types it directly or arrives via the hash redirect below.
export function useHashRoute() {
  const [path, setPath] = useState(() => currentPath());

  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener('popstate', onChange);
    window.addEventListener('pushstate', onChange);
    return () => {
      window.removeEventListener('popstate', onChange);
      window.removeEventListener('pushstate', onChange);
    };
  }, []);

  return path;
}

function currentPath(): string {
  const p = window.location.pathname || '/';
  // Normalise a stray hash path (#/admin/...) into a real path on first load,
  // so legacy hash links still land on the right screen.
  if ((p === '/' || p === '/index.html') && window.location.hash.startsWith('#/')) {
    const fromHash = window.location.hash.slice(1);
    window.history.replaceState({}, '', fromHash);
    return fromHash || '/';
  }
  return p === '' ? '/' : p;
}

export function navigate(to: string) {
  if (window.location.pathname === to) return;
  window.history.pushState({}, '', to);
  window.dispatchEvent(new Event('pushstate'));
  window.scrollTo(0, 0);
}

// Match a path against a pattern with params, e.g. matchPath('/schools/:id', '/schools/abc')
// returns { id: 'abc' } or null.
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i];
    const v = pathParts[i];
    if (p.startsWith(':')) {
      params[p.slice(1)] = decodeURIComponent(v);
    } else if (p !== v) {
      return null;
    }
  }
  return params;
}

import { useEffect, useState } from 'react';

export const ROUTES = ['verify', 'history', 'qr-studio', 'graph', 'dashboard'];
export const DEFAULT_ROUTE = 'verify';

export function currentRoute() {
  const hash = window.location.hash || '';
  const route = hash.replace(/^#\/?/, '').split('?')[0].replace(/\/$/, '');
  return route || DEFAULT_ROUTE;
}

export function navigate(route) {
  const next = `#/${route}`;
  if (window.location.hash === next) {
    window.dispatchEvent(new Event('hashchange'));
  } else {
    window.location.hash = next;
  }
}

export function useRoute() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}

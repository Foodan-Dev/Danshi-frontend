import type { Href } from 'expo-router';

const TAB_RETURN_PATHS: Record<string, string> = {
  '/explore': '/(tabs)/explore',
  '/myself': '/(tabs)/myself',
  '/search': '/(tabs)/search',
};

export function getPostComposerHref(returnTo: string): Href {
  return {
    pathname: '/(tabs)/post',
    params: { returnTo: TAB_RETURN_PATHS[returnTo] ?? returnTo },
  };
}

export function normalizePostComposerReturnTo(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return null;
  if (candidate === '/post' || candidate === '/(tabs)/post') return null;
  return candidate;
}

const DEV_HTTP_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '10.0.2.2']);

function parseUrl(value?: string | null): URL | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

export function isHttpsUrl(value?: string | null) {
  const url = parseUrl(value);
  return !!url && url.protocol === 'https:';
}

export function isHttpUrl(value?: string | null) {
  const url = parseUrl(value);
  return !!url && url.protocol === 'http:';
}

export function isHttpOrHttpsUrl(value?: string | null) {
  return isHttpsUrl(value) || isHttpUrl(value);
}

export function isAllowedDevHttpUrl(value?: string | null) {
  const url = parseUrl(value);
  return !!url && url.protocol === 'http:' && DEV_HTTP_HOSTS.has(url.hostname);
}

export function isSecureApiBaseUrl(value?: string | null) {
  return isHttpOrHttpsUrl(value);
}

export function getSafeRemoteUrl(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return isHttpOrHttpsUrl(trimmed) ? trimmed : undefined;
}

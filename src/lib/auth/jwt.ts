// 轻量 JWT 解码（不校验签名，仅解析 payload）
// 返回解析后的对象；若 token 无效则返回 null
export function decodeJwtPayload<T = unknown>(token: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = typeof atob === 'function'
      ? decodeURIComponent(escape(atob(padded)))
      : Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

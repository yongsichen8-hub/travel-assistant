import { cookies } from 'next/headers';
import { encrypt, decrypt } from './crypto';

interface TokenPayload {
  access_token: string;
  refresh_token: string;
  expires_at: number; // ms timestamp
}

// 模块级并发锁：避免多个请求同时刷新 token
let refreshPromise: Promise<TokenPayload> | null = null;

/**
 * 从加密 Cookie 中读取 token，如果即将过期则自动刷新。
 * 返回有效的 access_token，或 null（未登录/刷新失败）。
 *
 * 注意：此函数必须在 streamText() 之前调用（Trap 1），
 * 因为流开始后无法再设置 response cookie。
 */
export async function getValidAccessToken(): Promise<{
  accessToken: string;
  newCookieValue?: string; // 如果刷新了，调用方需要写回 cookie
} | null> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get('feishu_tokens');
  if (!tokenCookie?.value) return null;

  let payload: TokenPayload;
  try {
    payload = JSON.parse(decrypt(tokenCookie.value));
  } catch {
    return null;
  }

  // 还有 5 分钟以上有效期，直接使用
  const BUFFER_MS = 5 * 60 * 1000;
  if (payload.expires_at - Date.now() > BUFFER_MS) {
    return { accessToken: payload.access_token };
  }

  // 需要刷新
  if (!payload.refresh_token) return null;

  // 并发锁：如果已经有刷新请求在进行中，复用它
  if (refreshPromise) {
    try {
      const refreshed = await refreshPromise;
      return { accessToken: refreshed.access_token, newCookieValue: encrypt(JSON.stringify(refreshed)) };
    } catch {
      return null;
    }
  }

  refreshPromise = doRefresh(payload.refresh_token);
  try {
    const refreshed = await refreshPromise;
    return { accessToken: refreshed.access_token, newCookieValue: encrypt(JSON.stringify(refreshed)) };
  } catch {
    return null;
  } finally {
    refreshPromise = null;
  }
}

async function doRefresh(refreshToken: string): Promise<TokenPayload> {
  const appId = process.env.FEISHU_APP_ID?.trim();
  const appSecret = process.env.FEISHU_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new Error('Missing env');

  const res = await fetch('https://open.feishu.cn/open-apis/authen/v2/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: appId,
      client_secret: appSecret,
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();

  if (data.code !== 0 || !data.access_token) {
    throw new Error(data.msg || 'refresh failed');
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_at: Date.now() + (data.expires_in || 7200) * 1000,
  };
}

/**
 * 飞书 tenant_access_token 获取 + 模块级缓存
 * 用于 Bot 发消息（不依赖用户登录态）
 */

let cachedToken: string | null = null;
let cachedExpiresAt = 0;

export async function getTenantAccessToken(): Promise<string> {
  // 提前 200s 刷新，避免边界过期
  if (cachedToken && Date.now() < cachedExpiresAt - 200_000) {
    return cachedToken;
  }

  const appId = process.env.FEISHU_APP_ID?.trim();
  const appSecret = process.env.FEISHU_APP_SECRET?.trim();

  if (!appId || !appSecret) {
    throw new Error('FEISHU_APP_ID 或 FEISHU_APP_SECRET 未配置');
  }

  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });

  const data = await res.json();

  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`获取 tenant_access_token 失败: ${data.msg || JSON.stringify(data)}`);
  }

  cachedToken = data.tenant_access_token as string;
  cachedExpiresAt = Date.now() + (data.expire as number) * 1000;

  return cachedToken;
}

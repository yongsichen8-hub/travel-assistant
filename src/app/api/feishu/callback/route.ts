// 飞书 OAuth 回调：code → user_access_token → user_info → 设 Cookie → 重定向
// 官方文档:
//   Token: https://open.feishu.cn/document/authentication-management/access-token/get-user-access-token
//   UserInfo: https://open.feishu.cn/document/server-docs/authentication-management/login-state-management/get
import { NextResponse } from 'next/server';
import { encrypt } from '@/lib/auth/crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  // 构建前端可访问的 origin（优先从 X-Forwarded 头获取真实外部地址）
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host;
  const externalOrigin = `${proto}://${host}`;

  // 飞书授权拒绝或出错
  if (error || !code) {
    const msg = error || '缺少 code 参数';
    console.error('[feishu/callback] 授权失败:', msg);
    return NextResponse.redirect(new URL(`${basePath}/?error=${encodeURIComponent(msg)}`, externalOrigin));
  }

  const appId = process.env.FEISHU_APP_ID?.trim();
  const appSecret = process.env.FEISHU_APP_SECRET?.trim();
  const redirectUri = process.env.FEISHU_REDIRECT_URI?.trim();

  if (!appId || !appSecret) {
    console.error('[feishu/callback] 环境变量缺失');
    return NextResponse.redirect(new URL(`${basePath}/?error=服务端配置缺失`, externalOrigin));
  }

  try {
    // 1. 用 code 换取 user_access_token（v2 接口，直接传 client_id/client_secret）
    const tokenRes = await fetch('https://open.feishu.cn/open-apis/authen/v2/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: appId,
        client_secret: appSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenRes.json();

    console.log('[feishu/callback] token 响应:', JSON.stringify(tokenData, null, 2));

    if (tokenData.code !== 0 || !tokenData.access_token) {
      const msg = tokenData.msg || `token交换失败(code=${tokenData.code})`;
      console.error('[feishu/callback] token 获取失败:', msg);
      return NextResponse.redirect(new URL(`${basePath}/?error=${encodeURIComponent(msg)}`, externalOrigin));
    }

    const userAccessToken = tokenData.access_token as string;
    const refreshToken = (tokenData.refresh_token || '') as string;
    const expiresIn = (tokenData.expires_in || 7200) as number;
    const expiresAt = Date.now() + expiresIn * 1000;

    // 2. 用 user_access_token 获取用户信息
    const userInfoRes = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
      method: 'GET',
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    const userInfoData = await userInfoRes.json();

    console.log('[feishu/callback] userInfo 响应:', JSON.stringify(userInfoData, null, 2));

    if (userInfoData.code !== 0 || !userInfoData.data) {
      const msg = userInfoData.msg || '获取用户信息失败';
      console.error('[feishu/callback] 用户信息获取失败:', msg);
      return NextResponse.redirect(new URL(`${basePath}/?error=${encodeURIComponent(msg)}`, externalOrigin));
    }

    const d = userInfoData.data;
    const userInfo = {
      name: d.name || d.en_name || '飞书用户',
      avatarUrl: d.avatar_url || d.avatar_thumb || '',
      openId: d.open_id || '',
    };

    console.log('【获取用户信息成功】', userInfo);

    // 3. 设置 Cookie 并重定向回首页
    const cookieValue = Buffer.from(JSON.stringify(userInfo)).toString('base64');
    const response = NextResponse.redirect(new URL(`${basePath}/`, externalOrigin));
    response.cookies.set('feishu_user', cookieValue, {
      path: '/',
      maxAge: 7 * 24 * 3600, // 7 天
      sameSite: 'lax',
      httpOnly: false, // 前端需要读取
    });

    // 4. 加密存储 token（httpOnly，仅服务端可读）
    const encryptedTokens = encrypt(
      JSON.stringify({ access_token: userAccessToken, refresh_token: refreshToken, expires_at: expiresAt })
    );
    response.cookies.set('feishu_tokens', encryptedTokens, {
      path: '/',
      maxAge: 7 * 24 * 3600,
      sameSite: 'lax',
      httpOnly: true,
    });

    return response;
  } catch (err) {
    console.error('[feishu/callback] 异常:', err);
    const msg = err instanceof Error ? err.message : '未知异常';
    return NextResponse.redirect(new URL(`${basePath}/?error=${encodeURIComponent(msg)}`, externalOrigin));
  }
}

// 飞书 OAuth：生成授权 URL 并 302 重定向
// 官方文档: https://open.feishu.cn/document/authentication-management/access-token/obtain-oauth-code
import { NextResponse } from 'next/server';

export async function GET() {
  const appId = process.env.FEISHU_APP_ID?.trim();
  const redirectUri = process.env.FEISHU_REDIRECT_URI?.trim();

  if (!appId || !redirectUri) {
    return new Response('Missing Feishu Env Variables (FEISHU_APP_ID / FEISHU_REDIRECT_URI)', {
      status: 500,
    });
  }

  // 飞书官方标准 OAuth 端点（accounts.feishu.cn，参数用 client_id）
  const authUrl = new URL('https://accounts.feishu.cn/open-apis/authen/v1/authorize');
  authUrl.searchParams.append('client_id', appId);
  authUrl.searchParams.append('redirect_uri', redirectUri);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('scope', 'calendar:calendar:readonly calendar:calendar.event:create');
  authUrl.searchParams.append('state', crypto.randomUUID());

  console.log('【飞书授权跳转验证】', authUrl.toString());

  return NextResponse.redirect(authUrl.toString(), 302);
}

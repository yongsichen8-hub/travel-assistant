import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ ok: true });

  // 清除用户信息 cookie
  response.cookies.set('feishu_user', '', { path: '/', maxAge: 0 });
  // 清除加密 token cookie（httpOnly，前端无法直接删除）
  response.cookies.set('feishu_tokens', '', { path: '/', maxAge: 0, httpOnly: true });

  return response;
}

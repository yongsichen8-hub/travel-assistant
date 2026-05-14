import { cookies } from 'next/headers';
import { ItinerarySchema } from '@/lib/agent/schemas';
import { getTenantAccessToken } from '@/lib/feishu/tenant-token';
import { sendItineraryCard } from '@/lib/feishu/bot-message';
import { createItineraryEvents } from '@/lib/feishu/calendar-bot';
import { decrypt } from '@/lib/auth/crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { itinerary: rawItinerary, openId } = body;

    if (!openId || typeof openId !== 'string') {
      return Response.json({ error: '缺少 openId' }, { status: 400 });
    }

    // 验证行程数据
    const result = ItinerarySchema.safeParse(rawItinerary);
    if (!result.success) {
      return Response.json({ error: '行程数据格式无效' }, { status: 400 });
    }
    const itinerary = result.data;

    // Step 1: 获取 tenant_access_token (自管缓存，与用户无关)
    let tenantToken: string;
    try {
      tenantToken = await getTenantAccessToken();
    } catch (err) {
      return Response.json(
        { messageSent: false, eventsCreated: 0, error: `获取 Bot 凭证失败: ${err instanceof Error ? err.message : '未知错误'}` },
        { status: 500 }
      );
    }

    // Step 2: 发送 Bot 消息卡片 (优先保证)
    const messageResult = await sendItineraryCard(tenantToken, openId, itinerary);
    if (!messageResult.success) {
      return Response.json(
        { messageSent: false, eventsCreated: 0, error: messageResult.error },
        { status: 500 }
      );
    }

    // Step 3: 日历事件 (best-effort，user token 可能过期)
    let eventsCreated = 0;
    let calendarError: string | null = null;

    try {
      const cookieStore = await cookies();
      const tokensCookie = cookieStore.get('feishu_tokens')?.value;

      if (tokensCookie) {
        const decrypted = decrypt(tokensCookie);
        const tokens = JSON.parse(decrypted);
        const userAccessToken = tokens.access_token as string;

        if (userAccessToken) {
          const calResult = await createItineraryEvents(userAccessToken, itinerary);
          eventsCreated = calResult.eventsCreated;
          if (calResult.error) {
            calendarError = calResult.error;
          }
        } else {
          calendarError = '用户 token 为空，日历同步跳过';
        }
      } else {
        calendarError = '未找到飞书登录凭证，日历同步跳过';
      }
    } catch (err) {
      calendarError = `日历同步失败: ${err instanceof Error ? err.message : '未知错误'}`;
      console.error('[send-itinerary] 日历事件创建异常:', err);
    }

    return Response.json({
      messageSent: true,
      eventsCreated,
      calendarError,
    });
  } catch (err) {
    console.error('[send-itinerary] 未捕获异常:', err);
    return Response.json(
      { messageSent: false, eventsCreated: 0, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

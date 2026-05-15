import { ItinerarySchema } from '@/lib/agent/schemas';
import { getTenantAccessToken } from '@/lib/feishu/tenant-token';
import { sendItineraryCard } from '@/lib/feishu/bot-message';

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
        { messageSent: false, error: `获取 Bot 凭证失败: ${err instanceof Error ? err.message : '未知错误'}` },
        { status: 500 }
      );
    }

    // Step 2: 发送 Bot 消息卡片 (优先保证)
    const messageResult = await sendItineraryCard(tenantToken, openId, itinerary);
    if (!messageResult.success) {
      return Response.json(
        { messageSent: false, error: messageResult.error },
        { status: 500 }
      );
    }

    // 日历事件已改为用户按需逐个添加（见 ActivityRow 的日历按钮）
    return Response.json({
      messageSent: true,
    });
  } catch (err) {
    console.error('[send-itinerary] 未捕获异常:', err);
    return Response.json(
      { messageSent: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

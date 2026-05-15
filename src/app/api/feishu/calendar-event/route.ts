import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth/crypto';

/**
 * POST /api/feishu/calendar-event
 * 为单个活动创建精确时段的飞书日历事件
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, startTime, endTime, title, description } = body as {
      date: string;
      startTime: string;
      endTime?: string;
      title: string;
      description?: string;
    };

    if (!date || !startTime || !title) {
      return Response.json(
        { success: false, error: '缺少必要参数 (date, startTime, title)' },
        { status: 400 }
      );
    }

    // 从 cookies 获取并解密 user_access_token
    const cookieStore = await cookies();
    const tokensCookie = cookieStore.get('feishu_tokens')?.value;

    if (!tokensCookie) {
      return Response.json(
        { success: false, error: '未找到飞书登录凭证' },
        { status: 401 }
      );
    }

    let userAccessToken: string;
    try {
      const decrypted = decrypt(tokensCookie);
      const tokens = JSON.parse(decrypted);
      userAccessToken = tokens.access_token as string;
    } catch {
      return Response.json(
        { success: false, error: '飞书凭证解析失败，请重新登录' },
        { status: 401 }
      );
    }

    if (!userAccessToken) {
      return Response.json(
        { success: false, error: '用户 token 为空，请重新登录' },
        { status: 401 }
      );
    }

    // 获取用户主日历 ID
    const calendarId = await getPrimaryCalendarId(userAccessToken);
    if (!calendarId) {
      return Response.json(
        { success: false, error: '无法获取用户主日历' },
        { status: 500 }
      );
    }

    // 构造精确时段的时间戳（非全天事件）
    const startTs = Math.floor(new Date(`${date}T${startTime}:00+08:00`).getTime() / 1000);
    // 如果没有 endTime，默认加1小时
    const effectiveEndTime = endTime || addOneHour(startTime);
    const endTs = Math.floor(new Date(`${date}T${effectiveEndTime}:00+08:00`).getTime() / 1000);

    // 创建日历事件
    const res = await fetch(
      `https://open.feishu.cn/open-apis/calendar/v4/calendars/${calendarId}/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${userAccessToken}`,
        },
        body: JSON.stringify({
          summary: title,
          description: description || '',
          start_time: { timestamp: String(startTs) },
          end_time: { timestamp: String(endTs) },
        }),
      }
    );

    const data = await res.json();
    if (data.code === 0) {
      const eventId = data.data?.event?.event_id || '';
      return Response.json({ success: true, eventId });
    } else {
      console.error('[calendar-event] 创建事件失败:', data.msg);
      // token 过期错误
      if (data.code === 99991663 || data.code === 99991664) {
        return Response.json(
          { success: false, error: '飞书授权已过期，请重新登录' },
          { status: 401 }
        );
      }
      return Response.json(
        { success: false, error: data.msg || '创建日历事件失败' },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('[calendar-event] 未捕获异常:', err);
    return Response.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

/**
 * 给 HH:mm 时间字符串加1小时
 */
function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const newH = (h + 1) % 24;
  return `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * 获取用户主日历 ID
 */
async function getPrimaryCalendarId(userAccessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://open.feishu.cn/open-apis/calendar/v4/calendars/primary', {
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    const data = await res.json();
    if (data.code === 0 && data.data?.calendars?.[0]?.calendar?.calendar_id) {
      return data.data.calendars[0].calendar.calendar_id;
    }
    return data.data?.calendar?.calendar_id || null;
  } catch {
    return null;
  }
}

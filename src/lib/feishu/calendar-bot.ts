/**
 * 批量创建飞书日历事件（用 user_access_token，best-effort）
 */

import type { Itinerary } from '@/lib/types/itinerary';

/**
 * 为行程的每一天创建一个全天日历事件
 * 返回成功创建的事件数量
 */
export async function createItineraryEvents(
  userAccessToken: string,
  itinerary: Itinerary
): Promise<{ eventsCreated: number; error?: string }> {
  let eventsCreated = 0;

  // 获取用户主日历 ID
  const calendarId = await getPrimaryCalendarId(userAccessToken);
  if (!calendarId) {
    return { eventsCreated: 0, error: '无法获取用户主日历' };
  }

  for (const day of itinerary.days) {
    try {
      const activities = day.activities
        .map(a => `${a.time} ${a.title}`)
        .join('\n');

      const summary = `[差旅] Day ${day.dayNumber}: ${day.theme}`;
      const description = `${itinerary.origin.name} → ${itinerary.destination.name}\n\n${activities}`;

      // 创建全天事件
      const startTs = Math.floor(new Date(`${day.date}T00:00:00+08:00`).getTime() / 1000);
      const endTs = Math.floor(new Date(`${day.date}T23:59:59+08:00`).getTime() / 1000);

      const res = await fetch(
        `https://open.feishu.cn/open-apis/calendar/v4/calendars/${calendarId}/events`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: `Bearer ${userAccessToken}`,
          },
          body: JSON.stringify({
            summary,
            description,
            start_time: { timestamp: String(startTs) },
            end_time: { timestamp: String(endTs) },
          }),
        }
      );

      const data = await res.json();
      if (data.code === 0) {
        eventsCreated++;
      } else {
        console.error(`[calendar-bot] 创建事件失败 Day ${day.dayNumber}:`, data.msg);
        // 如果是 token 过期错误，提前中止
        if (data.code === 99991663 || data.code === 99991664) {
          return { eventsCreated, error: '飞书授权已过期，日历同步中断' };
        }
      }
    } catch (err) {
      console.error(`[calendar-bot] 创建事件异常 Day ${day.dayNumber}:`, err);
    }
  }

  return { eventsCreated };
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
    // 备用：尝试 v4 列表
    return data.data?.calendar?.calendar_id || null;
  } catch {
    return null;
  }
}

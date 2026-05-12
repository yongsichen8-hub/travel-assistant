import type { ListEventsResponse, CreateEventBody, CreateEventResponse } from './types';

const BASE = 'https://open.feishu.cn/open-apis/calendar/v4/calendars/primary';

/**
 * 查询主日历在某个时间范围内的日程列表。
 * 使用 "primary" 快捷方式代替 calendar_id（Trap 4）。
 */
export async function listEvents(
  accessToken: string,
  startTime: Date,
  endTime: Date,
): Promise<ListEventsResponse> {
  const url = new URL(`${BASE}/events`);
  // 飞书日历 API 使用秒级 Unix 时间戳
  url.searchParams.set('start_time', Math.floor(startTime.getTime() / 1000).toString());
  url.searchParams.set('end_time', Math.floor(endTime.getTime() / 1000).toString());

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
  return res.json() as Promise<ListEventsResponse>;
}

/**
 * 在主日历中创建新日程。
 */
export async function createEvent(
  accessToken: string,
  body: CreateEventBody,
): Promise<CreateEventResponse> {
  const res = await fetch(`${BASE}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<CreateEventResponse>;
}

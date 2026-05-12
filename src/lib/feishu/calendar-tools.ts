import { tool } from 'ai';
import { z } from 'zod';
import { listEvents, createEvent } from '@/lib/feishu/calendar';
import type { FeishuEvent } from '@/lib/feishu/types';

/**
 * 工厂函数：创建绑定了 user_access_token 的日历工具。
 * token 在创建时已解密好，工具执行时直接使用（避免 Trap 1：streaming 阶段无法读/写 cookie）。
 */
export function createCalendarTools(accessToken: string) {
  return {
    check_schedule: tool({
      description: '【必须最先调用】查询用户飞书日历中指定日期范围的真实日程，返回每天的已有会议/安排列表。在规划任何行程之前必须先调用此工具，然后才能调用 search_flights，选择航班时必须避开冲突时段。',
      inputSchema: z.object({
        dates: z.array(z.string()).describe('需要检查的日期列表，格式为 YYYY-MM-DD'),
      }),
      execute: async ({ dates }) => {
        try {
          // 计算总的时间范围
          const sorted = [...dates].sort();
          const startDate = new Date(sorted[0] + 'T00:00:00+08:00');
          const lastDate = new Date(sorted[sorted.length - 1] + 'T23:59:59+08:00');

          const res = await listEvents(accessToken, startDate, lastDate);
          if (res.code !== 0 || !res.data) {
            return { error: `飞书日历查询失败: ${res.msg || '未知错误'}` };
          }

          // 按请求的日期分组
          const dateSet = new Set(dates);
          const conflicts: Array<{ date: string; time: string; endTime: string; event_name: string }> = [];
          const availableDates: string[] = [];

          // 将日程按日期归类
          const eventsByDate = new Map<string, FeishuEvent[]>();
          for (const event of res.data.items) {
            const eventDate = getEventDate(event);
            if (eventDate && dateSet.has(eventDate)) {
              const list = eventsByDate.get(eventDate) || [];
              list.push(event);
              eventsByDate.set(eventDate, list);
            }
          }

          for (const date of dates) {
            const dayEvents = eventsByDate.get(date);
            if (dayEvents && dayEvents.length > 0) {
              for (const ev of dayEvents) {
                conflicts.push({
                  date,
                  time: formatTime(ev.start_time.timestamp),
                  endTime: formatTime(ev.end_time.timestamp),
                  event_name: ev.summary || '(无标题)',
                });
              }
            } else {
              availableDates.push(date);
            }
          }

          return { conflicts, available_dates: availableDates };
        } catch (error) {
          return { error: `日程检查失败: ${error instanceof Error ? error.message : '未知错误'}` };
        }
      },
    }),

    create_calendar_event: tool({
      description: '在用户飞书日历中创建新日程（如出差行程、航班提醒等）。',
      inputSchema: z.object({
        summary: z.string().describe('日程标题'),
        description: z.string().optional().describe('日程详细描述'),
        start_date: z.string().describe('开始日期 YYYY-MM-DD'),
        start_time: z.string().describe('开始时间 HH:mm（24小时制）'),
        end_date: z.string().describe('结束日期 YYYY-MM-DD'),
        end_time: z.string().describe('结束时间 HH:mm（24小时制）'),
      }),
      execute: async ({ summary, description, start_date, start_time, end_date, end_time }) => {
        try {
          const startTs = Math.floor(new Date(`${start_date}T${start_time}:00+08:00`).getTime() / 1000);
          const endTs = Math.floor(new Date(`${end_date}T${end_time}:00+08:00`).getTime() / 1000);

          const res = await createEvent(accessToken, {
            summary,
            description,
            start_time: { timestamp: startTs.toString(), timezone: 'Asia/Shanghai' },
            end_time: { timestamp: endTs.toString(), timezone: 'Asia/Shanghai' },
          });

          if (res.code !== 0 || !res.data) {
            return { error: `创建日程失败: ${res.msg || '未知错误'}` };
          }

          return {
            success: true,
            event_id: res.data.event.event_id,
            summary: res.data.event.summary,
            message: `已成功在飞书日历中创建日程「${summary}」`,
          };
        } catch (error) {
          return { error: `创建日程失败: ${error instanceof Error ? error.message : '未知错误'}` };
        }
      },
    }),
  };
}

/** 从日程中提取 YYYY-MM-DD 格式的日期 */
function getEventDate(event: FeishuEvent): string | null {
  if (event.start_time.date) return event.start_time.date;
  if (event.start_time.timestamp) {
    const d = new Date(Number(event.start_time.timestamp) * 1000);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}

/** 将秒级时间戳格式化为 HH:mm */
function formatTime(timestamp?: string): string {
  if (!timestamp) return '--:--';
  const d = new Date(Number(timestamp) * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

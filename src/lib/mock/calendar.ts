interface ScheduleEvent {
  date: string;
  time: string;
  endTime: string;
  title: string;
}

// 模拟的现有日程数据
const MOCK_EVENTS: ScheduleEvent[] = [
  { date: '2026-05-12', time: '09:00', endTime: '10:30', title: '产品周会' },
  { date: '2026-05-12', time: '14:00', endTime: '15:00', title: '1:1 与产品经理' },
  { date: '2026-05-13', time: '10:00', endTime: '11:30', title: '技术评审会' },
  { date: '2026-05-14', time: '09:30', endTime: '10:30', title: '全员大会' },
  { date: '2026-05-15', time: '15:00', endTime: '16:00', title: '客户演示' },
  { date: '2026-05-19', time: '09:00', endTime: '10:00', title: '冲刺规划会' },
  { date: '2026-05-20', time: '14:00', endTime: '15:30', title: '架构讨论' },
];

/**
 * 检查指定日期的日程冲突
 * MVP 阶段使用 mock 数据
 */
export async function checkSchedule(dates: string[]) {
  const conflicts: Array<{ date: string; time: string; endTime: string; event_name: string }> = [];
  const availableDates: string[] = [];

  for (const date of dates) {
    const dayEvents = MOCK_EVENTS.filter((e) => e.date === date);
    if (dayEvents.length > 0) {
      for (const event of dayEvents) {
        conflicts.push({
          date: event.date,
          time: event.time,
          endTime: event.endTime,
          event_name: event.title,
        });
      }
    } else {
      availableDates.push(date);
    }
  }

  return { conflicts, available_dates: availableDates };
}

'use client';

import type { DayPlan } from '@/lib/types/itinerary';
import { ActivityItem } from './ActivityItem';

export function DayCard({ day }: { day: DayPlan }) {
  return (
    <div>
      {/* 日期标题 */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          D{day.dayNumber}
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {day.date}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{day.theme}</p>
        </div>
      </div>

      {/* 活动列表 */}
      <div className="ml-4 border-l-2 border-zinc-200 pl-6 space-y-3 dark:border-zinc-700">
        {day.activities.map((activity) => (
          <ActivityItem key={activity.id} activity={activity} />
        ))}
      </div>
    </div>
  );
}

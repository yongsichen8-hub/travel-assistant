'use client';

import type { Activity } from '@/lib/types/itinerary';

const TYPE_ICONS: Record<string, string> = {
  transport: '🚗',
  flight: '✈️',
  attraction: '🏛️',
  meal: '🍽️',
  hotel: '🏨',
  meeting: '💼',
  free_time: '☕',
};

export function ActivityItem({ activity }: { activity: Activity }) {
  const icon = TYPE_ICONS[activity.type] || '📌';

  return (
    <div className="relative">
      {/* 时间轴圆点 */}
      <div className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900" />

      <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
        {/* 时间和标题 */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base">{icon}</span>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {activity.title}
            </span>
          </div>
          <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
            {activity.time}
            {activity.endTime && ` - ${activity.endTime}`}
          </span>
        </div>

        {/* 描述 */}
        {activity.description && (
          <p className="mt-1.5 text-xs text-zinc-600 leading-relaxed dark:text-zinc-400">
            {activity.description}
          </p>
        )}

        {/* 路线信息 */}
        {activity.route && (
          <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              {activity.route.mode === 'driving' ? '🚗' : activity.route.mode === 'transit' ? '🚌' : '🚶'}
            </span>
            <span>
              {(activity.route.distance / 1000).toFixed(1)} km
            </span>
            <span>·</span>
            <span>
              约 {Math.ceil(activity.route.duration / 60)} 分钟
            </span>
          </div>
        )}

        {/* 航班信息 */}
        {activity.flight && (
          <div className="mt-2 rounded bg-blue-50 px-2 py-1.5 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
            {activity.flight.airline} {activity.flight.flightNo} · {activity.flight.departureTime} → {activity.flight.arrivalTime}
            {activity.flight.price && ` · ¥${activity.flight.price}`}
          </div>
        )}

        {/* 小贴士 */}
        {activity.tips && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            💡 {activity.tips}
          </p>
        )}
      </div>
    </div>
  );
}

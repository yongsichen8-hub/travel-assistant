'use client';

import { useState } from 'react';
import type { Itinerary } from '@/lib/types/itinerary';
import { TimelineView } from './TimelineView';
import { MapViewer } from './MapViewer';

type ViewMode = 'timeline' | 'map';

export function ItineraryPanel({ itinerary, onClose }: { itinerary: Itinerary; onClose: () => void }) {
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [selectedDay, setSelectedDay] = useState(0);

  return (
    <div className="flex h-full flex-col">
      {/* 头部 */}
      <div className="sticky top-0 z-10 shrink-0 bg-white/90 backdrop-blur-sm border-b border-zinc-200 px-6 py-4 dark:bg-zinc-900/90 dark:border-zinc-700">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 truncate">
              {itinerary.title}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {itinerary.startDate} ~ {itinerary.endDate} · {itinerary.days.length}天
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle 按钮 */}
            <ViewToggle mode={viewMode} onChange={setViewMode} />
            {/* 收起按钮 */}
            <button
              onClick={onClose}
              title="收起面板"
              className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors dark:hover:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {itinerary.summary && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            {itinerary.summary}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge label={`${itinerary.totalDistance} km`} icon="📍" />
          {itinerary.estimatedBudget && (
            <Badge label={`≈ ¥${itinerary.estimatedBudget.total}`} icon="💰" />
          )}
        </div>
      </div>

      {/* 内容区 */}
      <div className="relative min-h-0 flex-1">
        {viewMode === 'timeline' ? (
          <div className="h-full overflow-y-auto px-6 py-4">
            <TimelineView days={itinerary.days} />
            {/* 出行提示 */}
            {itinerary.tips && itinerary.tips.length > 0 && (
              <div className="border-t border-zinc-200 mt-4 pt-4 dark:border-zinc-700">
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  出行提示
                </h3>
                <ul className="mt-2 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {itinerary.tips.map((tip, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-zinc-400">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full">
            <MapViewer days={itinerary.days} selectedDay={selectedDay} />
            {/* 悬浮 Day Selector */}
            <DaySelector
              days={itinerary.days}
              selectedDay={selectedDay}
              onChange={setSelectedDay}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 子组件 =====

function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex shrink-0 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
      <button
        onClick={() => onChange('timeline')}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === 'timeline'
            ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
            : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
        }`}
      >
        时间轴
      </button>
      <button
        onClick={() => onChange('map')}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === 'map'
            ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
            : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
        }`}
      >
        地图
      </button>
    </div>
  );
}

function DaySelector({
  days,
  selectedDay,
  onChange,
}: {
  days: { dayNumber: number; date: string; theme: string }[];
  selectedDay: number;
  onChange: (idx: number) => void;
}) {
  return (
    <div className="absolute left-4 top-4 z-20 flex gap-1.5 rounded-lg bg-white/95 p-1.5 shadow-lg backdrop-blur-sm dark:bg-zinc-900/95">
      {days.map((day, idx) => (
        <button
          key={idx}
          onClick={() => onChange(idx)}
          title={`${day.date} - ${day.theme}`}
          className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            selectedDay === idx
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
          }`}
        >
          Day {day.dayNumber}
        </button>
      ))}
    </div>
  );
}

function Badge({ label, icon }: { label: string; icon: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
      <span>{icon}</span>
      {label}
    </span>
  );
}

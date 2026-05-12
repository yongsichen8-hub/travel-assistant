'use client';

import { useState } from 'react';

interface ToolStep {
  toolName: string;
  state: string;
  startTime?: number;
}

const TOOL_LABELS: Record<string, string> = {
  geocode: '查询位置信息',
  search_poi: '搜索兴趣点',
  plan_route: '规划路线',
  search_flights: '搜索航班',
  search_nearby_hotels: '搜索酒店',
  check_schedule: '查询飞书日历',
  create_calendar_event: '创建日历日程',
  get_weather: '查询天气',
  generate_final_itinerary: '生成行程方案',
};

interface ThinkingProcessProps {
  steps: ToolStep[];
  isStreaming: boolean;
  totalTime?: number;
}

export function ThinkingProcess({ steps, isStreaming, totalTime }: ThinkingProcessProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (steps.length === 0) return null;

  const completedCount = steps.filter(s => s.state === 'output-available').length;
  const allDone = !isStreaming && completedCount === steps.length;

  const title = isStreaming
    ? '深度思考中...'
    : `工具调用已完成${totalTime ? `（用时 ${(totalTime / 1000).toFixed(1)}s）` : ''}`;

  return (
    <div className="mb-2 rounded-lg border border-zinc-200/60 bg-zinc-50/50 dark:border-zinc-700/60 dark:bg-zinc-800/50">
      {/* Header / Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-100/50 dark:hover:bg-zinc-700/30 rounded-lg"
      >
        {/* 图标 */}
        <span className={`text-sm ${isStreaming ? 'animate-pulse' : ''}`}>
          {isStreaming ? '✨' : '✅'}
        </span>
        {/* 标题 */}
        <span className="flex-1 font-medium text-zinc-600 dark:text-zinc-300">
          {title}
        </span>
        {/* 展开/收起箭头 */}
        <svg
          className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 展开的时间轴内容 */}
      {isOpen && (
        <div className="border-t border-zinc-200/60 px-3 py-2 dark:border-zinc-700/60">
          <div className="space-y-1.5">
            {steps.map((step, i) => {
              const label = TOOL_LABELS[step.toolName] || step.toolName;
              const isDone = step.state === 'output-available';
              const isActive = !isDone && (step.state === 'input-streaming' || step.state === 'input-available');

              return (
                <div key={`${step.toolName}-${i}`} className="flex items-center gap-2">
                  {/* 状态指示器 */}
                  <div className="flex h-4 w-4 items-center justify-center">
                    {isDone ? (
                      <svg className="h-3.5 w-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : isActive ? (
                      <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                    )}
                  </div>
                  {/* 步骤名称 */}
                  <span className={`text-xs ${
                    isDone
                      ? 'text-zinc-500 dark:text-zinc-400'
                      : isActive
                        ? 'text-blue-600 font-medium dark:text-blue-400'
                        : 'text-zinc-400 dark:text-zinc-500'
                  }`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

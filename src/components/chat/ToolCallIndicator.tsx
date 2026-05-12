'use client';

import type { UIMessage } from 'ai';

const TOOL_LABELS: Record<string, string> = {
  geocode: '正在查询位置信息',
  search_poi: '正在搜索兴趣点',
  plan_route: '正在规划路线',
  search_flights: '正在搜索航班',
  check_schedule: '正在检查日程冲突',
  get_weather: '正在查询天气',
  generate_final_itinerary: '正在生成行程方案',
};

export function ToolCallIndicator({ messages }: { messages: UIMessage[] }) {
  // 找到最后一条 assistant 消息中正在执行的工具
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  if (!lastAssistant) return <LoadingDots />;

  const activeTool = lastAssistant.parts.find((part) => {
    if (!('type' in part)) return false;
    const type = part.type as string;
    if (!type.startsWith('tool-')) return false;
    if (!('state' in part)) return false;
    return part.state === 'input-streaming' || part.state === 'input-available';
  });

  if (!activeTool || !('type' in activeTool)) return <LoadingDots />;

  const toolName = (activeTool.type as string).replace('tool-', '');
  const label = TOOL_LABELS[toolName] || `正在调用 ${toolName}`;

  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 pl-1">
      <span className="inline-flex gap-0.5">
        <span className="animate-bounce [animation-delay:0ms]">●</span>
        <span className="animate-bounce [animation-delay:150ms]">●</span>
        <span className="animate-bounce [animation-delay:300ms]">●</span>
      </span>
      <span>{label}</span>
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 pl-1">
      <span className="inline-flex gap-0.5">
        <span className="animate-bounce [animation-delay:0ms]">●</span>
        <span className="animate-bounce [animation-delay:150ms]">●</span>
        <span className="animate-bounce [animation-delay:300ms]">●</span>
      </span>
      <span>正在思考</span>
    </div>
  );
}

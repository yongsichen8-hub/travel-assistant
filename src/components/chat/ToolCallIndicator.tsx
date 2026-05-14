'use client';

import type { UIMessage } from 'ai';
import { getToolDescription, STANDARD_PIPELINE } from '@/lib/ui/tool-descriptions';

export function ToolCallIndicator({ messages }: { messages: UIMessage[] }) {
  // 找到最后一条 assistant 消息
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  if (!lastAssistant) return <LoadingDots label="正在思考" />;

  // 收集所有工具步骤的状态（用于 FlowPath）
  const toolStates = new Map<string, 'completed' | 'active'>();
  let activeToolName: string | undefined;
  let activeInput: Record<string, unknown> | undefined;

  for (const part of lastAssistant.parts) {
    if (!('type' in part)) continue;
    const type = part.type as string;
    if (!type.startsWith('tool-')) continue;

    const toolName = type.replace('tool-', '');
    const state = ('state' in part ? part.state : undefined) as string | undefined;

    if (state === 'output-available') {
      toolStates.set(toolName, 'completed');
    } else if (state === 'input-streaming' || state === 'input-available') {
      if (!toolStates.has(toolName) || toolStates.get(toolName) !== 'completed') {
        toolStates.set(toolName, 'active');
      }
      activeToolName = toolName;
      activeInput = ('input' in part ? part.input : undefined) as Record<string, unknown> | undefined;
    }
  }

  const label = activeToolName
    ? getToolDescription(activeToolName, activeInput)
    : '正在思考';

  // 构建 FlowPath 可见项
  const visiblePipeline = STANDARD_PIPELINE.filter(item =>
    toolStates.has(item.key) || item.key === 'generate_final_itinerary'
  );

  return (
    <div className="space-y-1 pl-1">
      {/* 流程路径 */}
      {visiblePipeline.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          {visiblePipeline.map((item, idx) => {
            const status = toolStates.get(item.key) || 'pending';
            return (
              <span key={item.key} className="flex items-center gap-1">
                {idx > 0 && <span className="text-zinc-300 dark:text-zinc-600">→</span>}
                <span className={
                  status === 'completed'
                    ? 'text-green-600 dark:text-green-400'
                    : status === 'active'
                      ? 'text-blue-600 font-medium animate-pulse dark:text-blue-400'
                      : 'text-zinc-400 dark:text-zinc-500'
                }>
                  {status === 'completed' ? '✓' : status === 'active' ? '●' : '○'}
                  {' '}
                  {item.label}
                </span>
              </span>
            );
          })}
        </div>
      )}
      {/* 动态描述 + 加载动画 */}
      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex gap-0.5">
          <span className="animate-bounce [animation-delay:0ms]">●</span>
          <span className="animate-bounce [animation-delay:150ms]">●</span>
          <span className="animate-bounce [animation-delay:300ms]">●</span>
        </span>
        <span>{label}</span>
      </div>
    </div>
  );
}

function LoadingDots({ label }: { label: string }) {
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

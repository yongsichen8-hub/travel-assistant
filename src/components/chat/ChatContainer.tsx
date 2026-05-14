'use client';

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ChatInput } from './ChatInput';
import { MessageBubble } from './MessageBubble';
import { ToolCallIndicator } from './ToolCallIndicator';
import { ThinkingProcess } from '@/components/ui/ThinkingProcess';
import { FlightCard, parseFlightsFromToolResult, type FlightData } from '@/components/ui/FlightCard';
import { useTravelConfig } from '@/lib/config/travel-config-context';
import { useChatStore } from '@/lib/store/chat-store';
import type { UIMessage } from 'ai';
import type { ResolvedTravelConfig } from '@/lib/types/travel-config';

export function ChatContainer({
  sessionId,
  initialMessages,
  onItineraryReady,
}: {
  sessionId: string;
  initialMessages: UIMessage[];
  onItineraryReady: (itinerary: unknown) => void;
}) {
  const { config, resolvedConfig, setActiveProfile } = useTravelConfig();
  const { updateSessionMessages } = useChatStore();

  // 仅首次挂载时使用（ref 保证后续 prop 变化不影响 useChat 初始化）
  const initialMessagesRef = useRef<UIMessage[]>(initialMessages);

  const { messages, sendMessage, status } = useChat({
    id: sessionId,
    transport: new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/chat`,
    }),
    messages: initialMessagesRef.current,
  });

  const lastItineraryIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevMessagesSnapshotRef = useRef<string>('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLoading = status === 'streaming' || status === 'submitted';

  // 去重：确保渲染的 messages 没有重复 ID（防御 localStorage 脏数据 + SDK 边界情况）
  const uniqueMessages = useMemo(() => {
    const seen = new Set<string>();
    return messages.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [messages]);

  // 自动保存消息到 localStorage（防抖 + 深度比较拦截死循环）
  useEffect(() => {
    if (!sessionId || uniqueMessages.length === 0) return;

    const snapshot = JSON.stringify(uniqueMessages);
    if (snapshot === prevMessagesSnapshotRef.current) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      prevMessagesSnapshotRef.current = snapshot;
      updateSessionMessages(sessionId, uniqueMessages);
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [uniqueMessages, sessionId, updateSessionMessages]);

  // 从消息中提取最新的行程数据（使用 useEffect 避免渲染中更新父状态）
  useEffect(() => {
    for (const msg of [...uniqueMessages].reverse()) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts) {
        if (
          'type' in part &&
          part.type === 'tool-generate_final_itinerary' &&
          'state' in part &&
          part.state === 'output-available' &&
          'output' in part &&
          'toolCallId' in part
        ) {
          const callId = (part as { toolCallId: string }).toolCallId;
          if (callId !== lastItineraryIdRef.current) {
            lastItineraryIdRef.current = callId;
            onItineraryReady(part.output);
          }
          return;
        }
      }
      break;
    }
  }, [uniqueMessages, onItineraryReady]);

  // 监听滚动：判断用户是否在底部附近（150px 阈值）
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 150;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // 自动滚动到底部（仅在用户未主动上滑时触发）
  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [uniqueMessages]);

  // 发送消息：@mention 检测 + per-call body override（无竞态）
  const handleSend = (text: string) => {
    let messageText = text;
    let activeProfile = resolvedConfig.activeProfile;

    // @mention 检测 — 按 name 长度降序匹配，避免部分匹配歧义
    const sorted = [...config.profiles].sort((a, b) => b.name.length - a.name.length);
    for (const profile of sorted) {
      const prefix = `@${profile.name}`;
      if (text.startsWith(prefix + ' ') || text === prefix) {
        messageText = text.startsWith(prefix + ' ') ? text.slice(prefix.length + 1) : '';
        activeProfile = profile;
        setActiveProfile(profile.id);
        break;
      }
    }

    const configToSend: ResolvedTravelConfig = {
      policy: resolvedConfig.policy,
      activeProfile,
    };

    sendMessage(
      { text: messageText },
      { body: { travelConfig: configToSend } }
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* 消息列表 */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {uniqueMessages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-zinc-400">
              <p className="text-lg font-medium">你好，我是差旅规划助手</p>
              <p className="mt-1 text-sm">
                告诉我你的出行需求，我来帮你规划行程
              </p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {[
                  '帮我规划下周从北京到上海的3天出差',
                  '我想去成都玩两天，喜欢美食和历史景点',
                  '从深圳到广州当天往返，需要参加下午的会议',
                ].map((hint) => (
                  <button
                    key={hint}
                    onClick={() => handleSend(hint)}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 transition-colors dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {uniqueMessages.map((message, idx) => (
          <MessageItem
            key={`${message.id}-${idx}`}
            message={message}
            isStreaming={isLoading && idx === uniqueMessages.length - 1 && message.role === 'assistant'}
            onSelectFlight={(flight) => {
              handleSend(`我选择航班 ${flight.flightNo}（${flight.airline} ${flight.departureTime}-${flight.arrivalTime}, ${flight.departureAirport}→${flight.arrivalAirport}），请据此重新规划行程`);
            }}
          />
        ))}

        {isLoading && <ToolCallIndicator messages={uniqueMessages} />}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <ChatInput
        onSend={handleSend}
        isLoading={isLoading}
      />
    </div>
  );
}

function MessageItem({ message, isStreaming, onSelectFlight }: { message: UIMessage; isStreaming: boolean; onSelectFlight: (flight: FlightData) => void }) {
  const isUser = message.role === 'user';

  // 提取文本内容
  const textParts = message.parts.filter(
    (p): p is { type: 'text'; text: string } => 'type' in p && p.type === 'text'
  );
  const text = textParts.map((p) => p.text).join('');

  if (!text && isUser) return null;

  // --- Assistant 消息：提取工具调用步骤 ---
  if (!isUser) {
    const toolSteps: Array<{ toolName: string; state: string; input?: Record<string, unknown> }> = [];
    // 按调用分组收集航班结果（去程/回程分别展示）
    const flightGroups: Array<{ flights: FlightData[] }> = [];

    for (const part of message.parts) {
      if (!('type' in part)) continue;
      const type = part.type as string;
      if (!type.startsWith('tool-')) continue;

      const toolName = type.replace('tool-', '');
      const state = ('state' in part ? part.state : 'unknown') as string;
      const input = ('input' in part ? part.input : undefined) as Record<string, unknown> | undefined;
      toolSteps.push({ toolName, state, input });

      // 收集航班结果（每次 search_flights 调用为独立分组）
      if (
        toolName === 'search_flights' &&
        state === 'output-available' &&
        'output' in part
      ) {
        const parsed = parseFlightsFromToolResult((part as { output: unknown }).output);
        if (parsed.length > 0) {
          flightGroups.push({ flights: parsed });
        }
      }
    }

    const hasToolSteps = toolSteps.length > 0;

    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] space-y-2">
          {/* 思考流折叠面板 */}
          {hasToolSteps && (
            <ThinkingProcess
              steps={toolSteps}
              isStreaming={isStreaming}
            />
          )}

          {/* 文本内容 */}
          {text && <MessageBubble role="assistant" content={text} />}

          {/* 航班卡片（按调用分组：去程/回程各自展示前5个） */}
          {flightGroups.map((group, groupIdx) => (
            <div key={`flight-group-${groupIdx}`} className="space-y-1.5">
              {flightGroups.length > 1 && (
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 pl-1">
                  {groupIdx === 0 ? '去程航班' : '回程航班'}
                </p>
              )}
              <div className="grid gap-2">
                {group.flights.slice(0, 5).map((flight, idx) => (
                  <FlightCard key={`${groupIdx}-${flight.flightNo}-${flight.departureTime}-${idx}`} flight={flight} onSelect={onSelectFlight} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <MessageBubble role={message.role} content={text} />;
}

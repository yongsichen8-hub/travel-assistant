'use client';

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ChatInput } from './ChatInput';
import { MessageBubble } from './MessageBubble';
import { ToolCallIndicator } from './ToolCallIndicator';
import { ThinkingProcess } from '@/components/ui/ThinkingProcess';
import { parseFlightsFromToolResult, type FlightData } from '@/components/ui/FlightCard';
import { InteractiveItineraryCard } from '@/components/itinerary/InteractiveItineraryCard';
import { ItinerarySchema } from '@/lib/agent/schemas';
import { useTravelConfig } from '@/lib/config/travel-config-context';
import { useChatStore } from '@/lib/store/chat-store';
import type { UIMessage } from 'ai';
import type { Itinerary } from '@/lib/types/itinerary';
import type { ResolvedTravelConfig } from '@/lib/types/travel-config';
import type { FlightCandidateGroup, HotelCandidate } from '@/lib/types/itinerary-card';

export function ChatContainer({
  sessionId,
  initialMessages,
}: {
  sessionId: string;
  initialMessages: UIMessage[];
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
            allMessages={uniqueMessages}
            isStreaming={isLoading && idx === uniqueMessages.length - 1 && message.role === 'assistant'}
            onRegenerateItinerary={handleSend}
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

/**
 * 从所有历史消息中收集航班和酒店候选数据
 * 按 itinerary.destination 过滤，避免跨行程数据污染
 */
function collectCandidates(
  allMessages: UIMessage[],
  itinerary: Itinerary
): { flightGroups: FlightCandidateGroup[]; hotelCandidates: HotelCandidate[] } {
  const destination = itinerary.destination.name;
  const flightGroups: FlightCandidateGroup[] = [];
  const hotelCandidates: HotelCandidate[] = [];

  for (const msg of allMessages) {
    if (msg.role !== 'assistant') continue;
    for (const part of msg.parts) {
      if (!('type' in part)) continue;
      const type = part.type as string;
      if (!type.startsWith('tool-')) continue;

      const toolName = type.replace('tool-', '');
      const state = ('state' in part ? part.state : '') as string;
      if (state !== 'output-available') continue;

      if (toolName === 'search_flights' && 'output' in part && 'input' in part) {
        const input = part.input as { departure_city?: string; arrival_city?: string; date?: string } | undefined;
        if (!input?.departure_city || !input?.arrival_city) continue;

        // 按目的地过滤: 只保留和当前行程目的地相关的航班
        const depCity = input.departure_city;
        const arrCity = input.arrival_city;
        if (!arrCity.includes(destination) && !destination.includes(arrCity) &&
            !depCity.includes(destination) && !destination.includes(depCity)) {
          continue;
        }

        const parsed = parseFlightsFromToolResult((part as { output: unknown }).output);
        if (parsed.length === 0) continue;

        // 动态判定方向：到达城市包含目的地 → 去程，出发城市包含目的地 → 返程
        let direction: 'outbound' | 'return' | 'unknown' = 'unknown';
        if (arrCity.includes(destination) || destination.includes(arrCity)) {
          direction = 'outbound';
        } else if (depCity.includes(destination) || destination.includes(depCity)) {
          direction = 'return';
        }

        flightGroups.push({
          direction,
          departureCity: depCity,
          arrivalCity: arrCity,
          date: input.date || '',
          flights: parsed,
        });
      }

      if (toolName === 'search_nearby_hotels' && 'output' in part) {
        try {
          const raw = (part as { output: unknown }).output;
          const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (data?.hotels && Array.isArray(data.hotels)) {
            for (const h of data.hotels) {
              hotelCandidates.push({
                name: h.name || '',
                address: h.address || '',
                distance: h.distance || '',
                price: h.price || '暂无',
                rating: h.rating || '',
              });
            }
          }
        } catch {
          // JSON 解析失败，跳过
        }
      }
    }
  }

  return { flightGroups, hotelCandidates };
}

function MessageItem({
  message,
  allMessages,
  isStreaming,
  onRegenerateItinerary,
}: {
  message: UIMessage;
  allMessages: UIMessage[];
  isStreaming: boolean;
  onRegenerateItinerary: (message: string) => void;
}) {
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
    let itineraryData: Itinerary | null = null;

    for (const part of message.parts) {
      if (!('type' in part)) continue;
      const type = part.type as string;
      if (!type.startsWith('tool-')) continue;

      const toolName = type.replace('tool-', '');
      const state = ('state' in part ? part.state : 'unknown') as string;
      const input = ('input' in part ? part.input : undefined) as Record<string, unknown> | undefined;
      toolSteps.push({ toolName, state, input });

      // 检测 generate_final_itinerary 输出
      if (
        toolName === 'generate_final_itinerary' &&
        state === 'output-available' &&
        'output' in part
      ) {
        const result = ItinerarySchema.safeParse((part as { output: unknown }).output);
        if (result.success) {
          itineraryData = result.data;
        }
      }
    }

    const hasToolSteps = toolSteps.length > 0;

    // 如果有行程卡片，收集候选数据并渲染 InteractiveItineraryCard
    if (itineraryData) {
      const { flightGroups: candidateFlights, hotelCandidates } = collectCandidates(allMessages, itineraryData);

      return (
        <div className="flex justify-start">
          <div className="w-full max-w-[95%] space-y-2">
            {hasToolSteps && (
              <ThinkingProcess steps={toolSteps} isStreaming={isStreaming} />
            )}
            <InteractiveItineraryCard
              itinerary={itineraryData}
              flightGroups={candidateFlights}
              hotelCandidates={hotelCandidates}
              onRegenerateItinerary={onRegenerateItinerary}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] space-y-2">
          {hasToolSteps && (
            <ThinkingProcess
              steps={toolSteps}
              isStreaming={isStreaming}
            />
          )}
          {text && <MessageBubble role="assistant" content={text} />}
        </div>
      </div>
    );
  }

  return <MessageBubble role={message.role} content={text} />;
}

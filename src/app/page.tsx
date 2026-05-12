'use client';

import { useState, useEffect, useRef } from 'react';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { ItineraryPanel } from '@/components/itinerary/ItineraryPanel';
import { useChatStore } from '@/lib/store/chat-store';
import type { Itinerary } from '@/lib/types/itinerary';
import { ItinerarySchema } from '@/lib/agent/schemas';

export default function Home() {
  const { activeSessionId, sessions } = useChatStore();
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [showItinerary, setShowItinerary] = useState(false);

  // 追踪本次页面生命周期中打开过的 session（保持挂载，不销毁流式连接）
  const mountedSessionsRef = useRef<Set<string>>(new Set());
  const [mountedSessions, setMountedSessions] = useState<string[]>([]);

  useEffect(() => {
    if (activeSessionId && !mountedSessionsRef.current.has(activeSessionId)) {
      mountedSessionsRef.current.add(activeSessionId);
      setMountedSessions(Array.from(mountedSessionsRef.current));
    }
  }, [activeSessionId]);

  // 当 session 被删除时，从已挂载集合中清除
  useEffect(() => {
    const existingIds = new Set(sessions.map(s => s.id));
    let changed = false;
    for (const id of mountedSessionsRef.current) {
      if (!existingIds.has(id)) {
        mountedSessionsRef.current.delete(id);
        changed = true;
      }
    }
    if (changed) {
      setMountedSessions(Array.from(mountedSessionsRef.current));
    }
  }, [sessions]);

  const handleItineraryReady = (raw: unknown) => {
    const result = ItinerarySchema.safeParse(raw);
    if (result.success) {
      setItinerary(result.data);
      setShowItinerary(true);
    }
  };

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* 聊天面板 — 所有已打开的 session 同时挂载，通过 display 切换可见性 */}
      <div
        className={`flex flex-col ${
          showItinerary ? 'h-1/2 md:h-full md:w-1/2 lg:w-2/5' : 'h-full w-full'
        } border-r border-zinc-200 dark:border-zinc-700 transition-all`}
      >
        {mountedSessions.map(sid => (
          <div
            key={sid}
            className="h-full w-full"
            style={{ display: sid === activeSessionId ? 'flex' : 'none', flexDirection: 'column' }}
          >
            <ChatContainer
              sessionId={sid}
              initialMessages={sessions.find(s => s.id === sid)?.messages || []}
              onItineraryReady={handleItineraryReady}
            />
          </div>
        ))}
      </div>

      {/* 行程面板 */}
      {showItinerary && itinerary && (
        <div className="h-1/2 md:h-full md:w-1/2 lg:w-3/5 bg-white dark:bg-zinc-900">
          <ItineraryPanel itinerary={itinerary} onClose={() => setShowItinerary(false)} />
        </div>
      )}

      {/* 行程面板收起时的展开按钮 */}
      {!showItinerary && itinerary && (
        <button
          onClick={() => setShowItinerary(true)}
          className="fixed right-4 top-4 z-50 flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-lg hover:bg-blue-700 transition-colors"
          title="展开行程面板"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V8z" clipRule="evenodd" />
          </svg>
          行程单
        </button>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { useChatStore } from '@/lib/store/chat-store';

export default function Home() {
  const { activeSessionId, sessions } = useChatStore();

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

  return (
    <div className="flex h-full flex-col">
      {/* 聊天面板 — 所有已打开的 session 同时挂载，通过 display 切换可见性 */}
      <div className="flex h-full w-full flex-col">
        {mountedSessions.map(sid => (
          <div
            key={sid}
            className="h-full w-full"
            style={{ display: sid === activeSessionId ? 'flex' : 'none', flexDirection: 'column' }}
          >
            <ChatContainer
              sessionId={sid}
              initialMessages={sessions.find(s => s.id === sid)?.messages || []}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

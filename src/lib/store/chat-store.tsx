'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { UIMessage } from 'ai';

export interface ChatSession {
  id: string;
  title: string;
  messages: UIMessage[];
  updatedAt: number;
}

interface ChatStoreContextValue {
  sessions: ChatSession[];
  activeSessionId: string;
  createSession: () => string;
  deleteSession: (id: string) => void;
  switchSession: (id: string) => void;
  updateSessionMessages: (id: string, messages: UIMessage[]) => void;
}

const ChatStoreContext = createContext<ChatStoreContextValue | null>(null);

const STORAGE_KEY = 'travel_chat_sessions';
const ACTIVE_KEY = 'travel_chat_active';

function generateId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateTitle(messages: UIMessage[]): string {
  const firstUserMsg = messages.find(m => m.role === 'user');
  if (!firstUserMsg) return '新的差旅规划';
  const textParts = firstUserMsg.parts.filter(
    (p): p is { type: 'text'; text: string } => 'type' in p && p.type === 'text'
  );
  const text = textParts.map(p => p.text).join('').trim();
  if (!text) return '新的差旅规划';
  return text.length > 15 ? text.slice(0, 15) + '...' : text;
}

function loadSessions(): ChatSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const sessions: ChatSession[] = JSON.parse(raw);
    // 清洗：确保每个 session 的 messages 没有重复 ID
    for (const session of sessions) {
      const seen = new Set<string>();
      session.messages = session.messages.filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
    }
    return sessions;
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch { /* quota exceeded — silent fail */ }
}

function loadActiveId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(ACTIVE_KEY) || '';
}

function saveActiveId(id: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_KEY, id);
}

export function ChatStoreProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  // 仅客户端 mount 后从 localStorage 加载（避免 SSR hydration mismatch）
  useEffect(() => {
    const stored = loadSessions();
    const storedActiveId = loadActiveId();

    if (stored.length === 0) {
      // 首次使用：创建默认 session
      const id = generateId();
      const newSession: ChatSession = { id, title: '新的差旅规划', messages: [], updatedAt: Date.now() };
      setSessions([newSession]);
      setActiveSessionId(id);
      saveSessions([newSession]);
      saveActiveId(id);
    } else {
      setSessions(stored);
      // 确保 activeId 有效
      const validId = stored.find(s => s.id === storedActiveId) ? storedActiveId : stored[0].id;
      setActiveSessionId(validId);
      saveActiveId(validId);
    }
    setMounted(true);
  }, []);

  const createSession = useCallback((): string => {
    const id = generateId();
    const newSession: ChatSession = { id, title: '新的差旅规划', messages: [], updatedAt: Date.now() };
    setSessions(prev => {
      const updated = [newSession, ...prev];
      saveSessions(updated);
      return updated;
    });
    setActiveSessionId(id);
    saveActiveId(id);
    return id;
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      if (updated.length === 0) {
        // 不能删到空：创建一个新的
        const newId = generateId();
        const newSession: ChatSession = { id: newId, title: '新的差旅规划', messages: [], updatedAt: Date.now() };
        saveSessions([newSession]);
        setActiveSessionId(newId);
        saveActiveId(newId);
        return [newSession];
      }
      saveSessions(updated);
      // 如果删的是当前激活的，切到第一个
      if (id === activeSessionId) {
        setActiveSessionId(updated[0].id);
        saveActiveId(updated[0].id);
      }
      return updated;
    });
  }, [activeSessionId]);

  const switchSession = useCallback((id: string) => {
    setActiveSessionId(id);
    saveActiveId(id);
  }, []);

  const updateSessionMessages = useCallback((id: string, messages: UIMessage[]) => {
    // 去重：以 message.id 为唯一标识，保留首次出现的消息
    const seen = new Set<string>();
    const deduped = messages.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    setSessions(prev => {
      const updated = prev.map(s => {
        if (s.id !== id) return s;
        const title = deduped.length > 0 ? generateTitle(deduped) : s.title;
        return { ...s, messages: deduped, title, updatedAt: Date.now() };
      });
      saveSessions(updated);
      return updated;
    });
  }, []);

  // mount 前返回最小骨架（避免 hydration mismatch）
  if (!mounted) {
    return (
      <ChatStoreContext.Provider value={{
        sessions: [],
        activeSessionId: '',
        createSession: () => '',
        deleteSession: () => {},
        switchSession: () => {},
        updateSessionMessages: () => {},
      }}>
        {children}
      </ChatStoreContext.Provider>
    );
  }

  return (
    <ChatStoreContext.Provider value={{
      sessions,
      activeSessionId,
      createSession,
      deleteSession,
      switchSession,
      updateSessionMessages,
    }}>
      {children}
    </ChatStoreContext.Provider>
  );
}

export function useChatStore() {
  const ctx = useContext(ChatStoreContext);
  if (!ctx) throw new Error('useChatStore must be used within ChatStoreProvider');
  return ctx;
}

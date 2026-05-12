'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useFeishuUser } from '@/lib/auth/feishu-user-context';
import { useChatStore } from '@/lib/store/chat-store';

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useFeishuUser();
  const { sessions, activeSessionId, createSession, deleteSession, switchSession } = useChatStore();
  const [sessionsExpanded, setSessionsExpanded] = useState(true);

  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  const isOnChatPage = pathname === '/';

  return (
    <aside className="flex h-screen w-60 flex-col bg-slate-900 text-slate-300">
      {/* Logo 区 */}
      <div className="flex h-14 items-center gap-2 px-5 border-b border-slate-700/50">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white text-sm font-bold">
          X
        </div>
        <span className="text-sm font-semibold text-white tracking-wide">
          XPENG 差旅管家
        </span>
      </div>

      {/* 导航 + 会话列表 */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {/* 差旅规划 + 新建按钮 */}
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className={`flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isOnChatPage
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            差旅规划
          </Link>
          {/* 新建差旅按钮 */}
          <button
            onClick={() => { createSession(); }}
            title="新建差旅"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>

        {/* 会话历史列表 (可折叠) */}
        {isOnChatPage && sessions.length > 0 && (
          <div className="ml-2">
            {/* 折叠切换 */}
            <button
              onClick={() => setSessionsExpanded(!sessionsExpanded)}
              className="flex w-full items-center gap-1 px-2 py-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              <svg
                className={`h-3 w-3 transition-transform ${sessionsExpanded ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              <span>历史对话 ({sessions.length})</span>
            </button>

            {sessionsExpanded && (
              <div className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
                {sortedSessions.map(session => (
                  <div
                    key={session.id}
                    className={`group flex items-center rounded-md px-2 py-1.5 text-xs cursor-pointer transition-colors ${
                      session.id === activeSessionId
                        ? 'bg-slate-700/80 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                    onClick={() => switchSession(session.id)}
                  >
                    <span className="flex-1 truncate">{session.title}</span>
                    {/* 删除按钮 (hover 可见) */}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                      className="hidden group-hover:flex h-4 w-4 items-center justify-center rounded text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 差旅政策 */}
        <Link
          href="/policy"
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            pathname.startsWith('/policy')
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
          </svg>
          差旅政策
        </Link>

        {/* 用户偏好 */}
        <Link
          href="/profiles"
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            pathname.startsWith('/profiles')
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          用户偏好
        </Link>
      </nav>

      {/* 底部用户区 */}
      <div className="border-t border-slate-700/50 px-4 py-3">
        {user ? (
          <div className="flex items-center gap-2">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={user.name}
                width={32}
                height={32}
                className="rounded-full"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs text-slate-300">
                {user.name.slice(0, 2)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">{user.name}</p>
              <button
                onClick={logout}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                退出登录
              </button>
            </div>
          </div>
        ) : (
          <a
            href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/feishu/auth`}
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            飞书授权登录
          </a>
        )}
      </div>
    </aside>
  );
}

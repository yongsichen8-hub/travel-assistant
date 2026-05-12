'use client';

import type { ReactNode } from 'react';
import { useFeishuUser } from '@/lib/auth/feishu-user-context';
import { Sidebar } from '@/components/layout/Sidebar';
import { LoginScreen } from '@/components/auth/LoginScreen';

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useFeishuUser();

  // 未登录：全屏登录页，无 Sidebar
  if (!user) {
    return <LoginScreen />;
  }

  // 已登录：标准 B2B SaaS 布局
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-zinc-900">
        {children}
      </main>
    </div>
  );
}

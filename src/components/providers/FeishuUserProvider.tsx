'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { FeishuUserContext } from '@/lib/auth/feishu-user-context';
import type { FeishuUser } from '@/lib/auth/feishu-user-context';

interface Props {
  initialUser: FeishuUser | null;
  children: ReactNode;
}

export function FeishuUserProvider({ initialUser, children }: Props) {
  const [user, setUser] = useState<FeishuUser | null>(initialUser);

  const logout = useCallback(async () => {
    // 调用服务端登出接口，同时清除 httpOnly 的 feishu_tokens cookie
    await fetch('/api/feishu/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  }, []);

  return (
    <FeishuUserContext.Provider value={{ user, logout }}>
      {children}
    </FeishuUserContext.Provider>
  );
}

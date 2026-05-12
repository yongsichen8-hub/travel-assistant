'use client';

import { createContext, useContext } from 'react';

export interface FeishuUser {
  name: string;
  avatarUrl: string;
  openId: string;
}

export interface FeishuUserContextValue {
  user: FeishuUser | null;
  logout: () => void;
}

export const FeishuUserContext = createContext<FeishuUserContextValue>({
  user: null,
  logout: () => {},
});

export function useFeishuUser() {
  return useContext(FeishuUserContext);
}

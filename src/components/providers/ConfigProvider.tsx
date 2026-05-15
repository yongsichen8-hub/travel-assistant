'use client';

import { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { TravelConfigContext } from '@/lib/config/travel-config-context';
import { INITIAL_CONFIG } from '@/lib/config/default-policy';
import { resolveConfig } from '@/lib/types/travel-config';
import type { TravelConfig, TravelPolicy, TravelProfile } from '@/lib/types/travel-config';

const STORAGE_KEY = 'travel-assistant-config';

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<TravelConfig>(INITIAL_CONFIG);

  // 从 localStorage 恢复（仅客户端首次挂载）
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<TravelConfig>;
        setConfig((prev) => ({
          ...prev,
          ...parsed,
          policy: prev.policy, // policy 始终用代码中的默认值
          policyOverrides: parsed.policyOverrides ?? {},
          profiles: parsed.profiles ?? [],
          activeProfileId: parsed.activeProfileId ?? null,
        }));
      }
    } catch {
      // localStorage 解析失败时静默忽略，使用默认值
    }
  }, []);

  // 持久化到 localStorage
  useEffect(() => {
    try {
      const toStore: Partial<TravelConfig> = {
        policyOverrides: config.policyOverrides,
        profiles: config.profiles,
        activeProfileId: config.activeProfileId,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // 存储失败静默忽略
    }
  }, [config.policyOverrides, config.profiles, config.activeProfileId]);

  const resolvedConfig = useMemo(() => resolveConfig(config), [config]);

  const updatePolicy = useCallback((overrides: Partial<TravelPolicy>) => {
    setConfig((prev) => ({
      ...prev,
      policyOverrides: { ...prev.policyOverrides, ...overrides },
    }));
  }, []);

  const resetPolicy = useCallback(() => {
    setConfig((prev) => ({ ...prev, policyOverrides: {} }));
  }, []);

  const addProfile = useCallback((profile: Omit<TravelProfile, 'id'>) => {
    const newProfile: TravelProfile = {
      ...profile,
      id: (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    };
    setConfig((prev) => ({
      ...prev,
      profiles: [...prev.profiles, newProfile],
    }));
  }, []);

  const updateProfile = useCallback((id: string, changes: Partial<TravelProfile>) => {
    setConfig((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === id ? { ...p, ...changes } : p
      ),
    }));
  }, []);

  const deleteProfile = useCallback((id: string) => {
    setConfig((prev) => ({
      ...prev,
      profiles: prev.profiles.filter((p) => p.id !== id),
      activeProfileId: prev.activeProfileId === id ? null : prev.activeProfileId,
    }));
  }, []);

  const setActiveProfile = useCallback((id: string | null) => {
    setConfig((prev) => ({ ...prev, activeProfileId: id }));
  }, []);

  const getProfileByName = useCallback(
    (name: string) => config.profiles.find((p) => p.name === name),
    [config.profiles]
  );

  return (
    <TravelConfigContext.Provider
      value={{
        config,
        resolvedConfig,
        updatePolicy,
        resetPolicy,
        addProfile,
        updateProfile,
        deleteProfile,
        setActiveProfile,
        getProfileByName,
      }}
    >
      {children}
    </TravelConfigContext.Provider>
  );
}

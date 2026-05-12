'use client';

import { createContext, useContext } from 'react';
import type {
  TravelConfig,
  TravelPolicy,
  TravelProfile,
  ResolvedTravelConfig,
} from '@/lib/types/travel-config';

export interface TravelConfigContextValue {
  config: TravelConfig;
  resolvedConfig: ResolvedTravelConfig;
  updatePolicy: (overrides: Partial<TravelPolicy>) => void;
  resetPolicy: () => void;
  addProfile: (profile: Omit<TravelProfile, 'id'>) => void;
  updateProfile: (id: string, changes: Partial<TravelProfile>) => void;
  deleteProfile: (id: string) => void;
  setActiveProfile: (id: string | null) => void;
  getProfileByName: (name: string) => TravelProfile | undefined;
}

export const TravelConfigContext = createContext<TravelConfigContextValue | null>(null);

export function useTravelConfig(): TravelConfigContextValue {
  const ctx = useContext(TravelConfigContext);
  if (!ctx) {
    throw new Error('useTravelConfig must be used within a ConfigProvider');
  }
  return ctx;
}

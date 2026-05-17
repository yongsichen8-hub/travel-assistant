'use client';

import { useState } from 'react';
import type { HotelCandidate } from '@/lib/types/itinerary-card';

interface Props {
  activityId: string;
  currentHotelName: string;
  currentAddress?: string;
  city: string;
  initialCandidates: HotelCandidate[];
  currentOverride?: HotelCandidate;
  onSwitch: (hotel: HotelCandidate) => void;
  disabled?: boolean;
}

export function HotelSwitcher({ currentHotelName, currentAddress, city, initialCandidates, currentOverride, onSwitch, disabled }: Props) {
  const [showSearch, setShowSearch] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<HotelCandidate[]>(initialCandidates);
  const [isSearching, setIsSearching] = useState(false);

  const displayName = currentOverride?.name || currentHotelName;

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/hotels/search?city=${encodeURIComponent(city)}&keyword=${encodeURIComponent(keyword.trim())}`
      );
      if (res.ok) {
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      }
    } catch {
      // 搜索失败，保留现有结果
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (hotel: HotelCandidate) => {
    onSwitch(hotel);
    setShowSearch(false);
  };

  return (
    <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-2.5 dark:border-amber-900/50 dark:bg-amber-950/20">
      {/* 当前酒店 */}
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            🏨 {displayName}
          </span>
          {/* 显示地址：优先用 override 地址，否则用 activity 原始地址 */}
          {(currentOverride?.address || currentAddress) && (
            <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              {currentOverride?.address || currentAddress}
              {currentOverride?.rating && ` | 评分: ${currentOverride.rating}`}
              {currentOverride?.price && currentOverride.price !== '暂无' && ` | 参考价: ¥${currentOverride.price}`}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="ml-2 shrink-0 text-xs hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-blue-600"
        >
          {showSearch ? '收起' : '更换酒店'}
        </button>
      </div>

      {currentOverride && (
        <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
          已切换酒店
        </p>
      )}

      {/* 搜索面板 */}
      {showSearch && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={`在${city}搜索酒店...`}
              className="flex-1 rounded border border-zinc-200 bg-white px-2 py-1 text-xs placeholder:text-zinc-400 focus:border-blue-400 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:placeholder:text-zinc-500"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="rounded bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSearching ? '...' : '搜索'}
            </button>
          </div>

          {/* 搜索结果 */}
          {results.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {results.map((hotel, idx) => (
                <button
                  key={`${hotel.name}-${idx}`}
                  onClick={() => handleSelect(hotel)}
                  className="w-full rounded border border-zinc-100 bg-white p-2 text-left hover:border-blue-300 hover:bg-blue-50 transition-colors dark:border-zinc-600 dark:bg-zinc-700 dark:hover:border-blue-600 dark:hover:bg-zinc-600"
                >
                  <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{hotel.name}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {hotel.distance && <span>{hotel.distance}m</span>}
                    {hotel.rating && <span>评分 {hotel.rating}</span>}
                    {hotel.price && hotel.price !== '暂无' && <span>¥{hotel.price}起</span>}
                  </div>
                  {hotel.address && (
                    <div className="text-[11px] text-zinc-400 mt-0.5 dark:text-zinc-500 truncate">{hotel.address}</div>
                  )}
                </button>
              ))}
            </div>
          )}

          {results.length === 0 && !isSearching && keyword && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">未找到酒店，请尝试其他关键词</p>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { MapViewer } from './MapViewer';
import type { Itinerary, Activity, FlightInfo } from '@/lib/types/itinerary';
import type { FlightCandidateGroup, HotelCandidate } from '@/lib/types/itinerary-card';
import type { FlightData } from '@/components/ui/FlightCard';
import { FlightSwitcher } from './FlightSwitcher';
import { HotelSwitcher } from './HotelSwitcher';
import { useFeishuUser } from '@/lib/auth/feishu-user-context';

interface Props {
  itinerary: Itinerary;
  flightGroups: FlightCandidateGroup[];
  hotelCandidates: HotelCandidate[];
  onRegenerateItinerary?: (message: string) => void;
  isChatLoading?: boolean;
}

export function InteractiveItineraryCard({ itinerary, flightGroups, hotelCandidates, onRegenerateItinerary, isChatLoading }: Props) {
  const { user } = useFeishuUser();
  const [flightOverrides, setFlightOverrides] = useState<Record<string, FlightData>>({});
  const [hotelOverrides, setHotelOverrides] = useState<Record<string, HotelCandidate>>({});
  const [aircraftMap, setAircraftMap] = useState<Record<string, string>>({});
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [sendError, setSendError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'map'>('timeline');
  const [selectedDay, setSelectedDay] = useState(0);

  // Draft Mode 状态
  const [isEditing, setIsEditing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [draftModifications, setDraftModifications] = useState<{
    flights?: Record<string, FlightData>;
    hotel?: string;
  }>({});

  // 当父组件返回新数据时，自动清除 regenerating 和 draft 状态
  useEffect(() => {
    if (isRegenerating) {
      setIsRegenerating(false);
      setDraftModifications({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itinerary]);

  // 当聊天加载状态变化时，重置 isRegenerating
  // 使用 hasSeenLoadingRef 跟踪本次重生成是否出现过 loading，
  // 解决 React 批处理导致 isChatLoading 的 true→false 过渡被跳帧的问题
  const hasSeenLoadingRef = useRef(false);
  useEffect(() => {
    if (isRegenerating) {
      if (isChatLoading) {
        hasSeenLoadingRef.current = true;
      }
      // 一旦出现过 loading 且现在已结束，立即重置
      if (hasSeenLoadingRef.current && !isChatLoading) {
        setIsRegenerating(false);
        setDraftModifications({});
        hasSeenLoadingRef.current = false;
      }
    } else {
      hasSeenLoadingRef.current = false;
    }
  }, [isChatLoading, isRegenerating]);

  // 获取目的地城市用于酒店搜索
  const destinationCity = itinerary.destination.name;

  // 异步获取机型信息（FR24）
  useEffect(() => {
    if (!flightGroups || flightGroups.length === 0) return;

    // 收集所有唯一航班号
    const flightNos = new Set<string>();
    flightGroups.forEach(group => {
      group.flights.forEach(flight => {
        if (flight.flightNo) flightNos.add(flight.flightNo);
      });
    });

    // 异步获取机型（最多 60 个航班号，覆盖完整航班列表）
    const fetchAircraft = async () => {
      const entries: [string, string][] = [];
      const batch = Array.from(flightNos).slice(0, 60);

      for (const flightNo of batch) {
        try {
          const res = await fetch(`/travel/api/flights/enrich`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ flightNo }),
          });
          const data = await res.json();
          if (data.aircraft) {
            entries.push([flightNo, data.aircraft]);
          }
        } catch {
          // 静默忽略
        }
        // 200ms 间隔避免限流
        await new Promise(r => setTimeout(r, 200));
      }

      if (entries.length > 0) {
        setAircraftMap(prev => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    };

    fetchAircraft();
  }, [flightGroups]);

  // 计算 dirty itinerary（合并覆盖）
  const dirtyItinerary = useMemo((): Itinerary => {
    const updatedDays = itinerary.days.map(day => ({
      ...day,
      activities: day.activities.map(activity => {
        // 航班覆盖
        if (activity.type === 'flight' && flightOverrides[activity.id]) {
          const f = flightOverrides[activity.id];
          const updatedFlight: FlightInfo = {
            flightNo: f.flightNo,
            airline: f.airline,
            departureCity: f.departureCity || activity.flight?.departureCity || '',
            arrivalCity: f.arrivalCity || activity.flight?.arrivalCity || '',
            departureTime: f.departureTime,
            arrivalTime: f.arrivalTime,
            price: f.price ?? activity.flight?.price,
            cabinClass: activity.flight?.cabinClass,
          };
          return {
            ...activity,
            title: `${f.airline} ${f.flightNo}`,
            time: f.departureTime,
            endTime: f.arrivalTime,
            flight: updatedFlight,
          };
        }
        // 酒店覆盖
        if (activity.type === 'hotel' && hotelOverrides[activity.id]) {
          const h = hotelOverrides[activity.id];
          return {
            ...activity,
            title: h.name,
            description: `${h.address} | 评分: ${h.rating} | 参考价: ${h.price}`,
          };
        }
        return activity;
      }),
    }));
    return { ...itinerary, days: updatedDays };
  }, [itinerary, flightOverrides, hotelOverrides]);

  const handleFlightSwitch = useCallback((activityId: string, flight: FlightData) => {
    if (isEditing) {
      // 编辑模式：修改存入 draftModifications
      setDraftModifications(prev => ({
        ...prev,
        flights: { ...prev.flights, [activityId]: flight },
      }));
    } else {
      // 非编辑模式（不应出现，但做兜底）
      setFlightOverrides(prev => ({ ...prev, [activityId]: flight }));
    }
  }, [isEditing]);

  const handleHotelSwitch = useCallback((activityId: string, hotel: HotelCandidate) => {
    // 酒店始终直接应用（无需编辑模式），确保点击后立即生效
    setHotelOverrides(prev => ({ ...prev, [activityId]: hotel }));
    if (isEditing) {
      // 编辑模式下同时记录到 draft，用于重生成消息
      setDraftModifications(prev => ({
        ...prev,
        hotel: hotel.name,
      }));
    }
  }, [isEditing]);

  const handleSendToFeishu = async () => {
    if (!user?.openId) return;
    setSendStatus('sending');
    setSendError(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/feishu/send-itinerary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itinerary: dirtyItinerary, openId: user.openId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `请求失败 (${res.status})`);
      }

      const data = await res.json();
      if (data.messageSent) {
        setSendStatus('sent');
      } else {
        throw new Error(data.error || '发送失败');
      }
    } catch (err) {
      setSendStatus('error');
      setSendError(err instanceof Error ? err.message : '发送失败');
    }
  };

  // 构造重生成描述消息
  const buildRegenerateMessage = useCallback((): string => {
    const parts: string[] = [];

    if (draftModifications.flights) {
      for (const [activityId, flight] of Object.entries(draftModifications.flights)) {
        // 找到对应 activity 以确定方向标签
        let directionLabel = '航班';
        for (const day of itinerary.days) {
          const act = day.activities.find(a => a.id === activityId);
          if (act) {
            const group = flightGroups.find(g =>
              g.departureCity.includes(act.flight?.departureCity || '') ||
              act.flight?.departureCity.includes(g.departureCity)
            );
            if (group) {
              directionLabel = group.direction === 'outbound' ? '去程航班' : group.direction === 'return' ? '返程航班' : '航班';
            }
            break;
          }
        }

        let msg = `用户已将${directionLabel}修改为：[${flight.departureTime}-${flight.arrivalTime}] ${flight.flightNo} | ${flight.airline}`;
        if (flight.price && flight.price > 0) msg += ` | ¥${flight.price}`;
        if (flight.stops !== undefined) msg += ` | ${flight.stops === 0 ? '直飞' : `经停${flight.stops}`}`;
        msg += '。请根据新的航班到达时间，重新合理规划当天的后续行程。';
        parts.push(msg);
      }
    }

    if (draftModifications.hotel) {
      parts.push(`用户已将酒店修改为：${draftModifications.hotel}。请根据新酒店的位置，重新合理规划行程安排。`);
    }

    return parts.length > 0 ? parts.join('\n') : '';
  }, [draftModifications, itinerary.days, flightGroups]);

  // 确认修改
  const handleConfirmEdit = useCallback(() => {
    const message = buildRegenerateMessage();
    if (!message) {
      // 没有实际修改，直接退出编辑
      setIsEditing(false);
      setDraftModifications({});
      return;
    }

    // 将 draft 中的航班修改应用到 overrides
    if (draftModifications.flights) {
      setFlightOverrides(prev => ({ ...prev, ...draftModifications.flights }));
    }
    // 酒店修改已在 handleHotelSwitch 中直接应用到 hotelOverrides，无需再次 apply

    // 调用回调通知父组件
    onRegenerateItinerary?.(message);
    setIsRegenerating(true);
    setIsEditing(false);
  }, [draftModifications, buildRegenerateMessage, onRegenerateItinerary]);

  // 取消编辑
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setDraftModifications({});
  }, []);

  // 计算 dirty itinerary 中的航班覆盖：编辑模式下优先使用 draft 值
  const effectiveFlightOverrides = useMemo(() => {
    if (isEditing && draftModifications.flights) {
      return { ...flightOverrides, ...draftModifications.flights };
    }
    return flightOverrides;
  }, [isEditing, draftModifications.flights, flightOverrides]);

  // 预算
  const budget = dirtyItinerary.estimatedBudget;

  return (
    <div className="relative w-full rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden dark:border-zinc-700 dark:bg-zinc-800">
      {/* Loading 覆盖层 */}
      {isRegenerating && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-lg">
          <div className="flex items-center gap-2 text-gray-600 text-sm">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            重新规划中...
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 dark:from-blue-950/30 dark:to-indigo-950/30">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {dirtyItinerary.title}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {dirtyItinerary.startDate} ~ {dirtyItinerary.endDate}
            </p>
          </div>
          {/* 修改行程 / 确认修改 / 取消 按钮 */}
          <div className="flex items-center gap-2">
            {isEditing && (
              <button
                onClick={handleCancelEdit}
                className="text-gray-500 text-xs border border-gray-300 px-3 py-1 rounded hover:bg-gray-50"
              >
                取消
              </button>
            )}
            {isRegenerating ? (
              <span className="flex items-center gap-1 bg-blue-600 text-white text-xs px-3 py-1 rounded">
                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                重新规划中...
              </span>
            ) : isEditing ? (
              <button
                onClick={handleConfirmEdit}
                className="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700"
              >
                确认修改
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="text-gray-500 text-xs border border-gray-300 px-3 py-1 rounded hover:bg-gray-50"
              >
                修改行程
              </button>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
            {dirtyItinerary.origin.name} → {dirtyItinerary.destination.name}
          </span>
          {budget && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              预算 ¥{budget.total}
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/50 dark:text-green-300">
            {dirtyItinerary.days.length}天行程
          </span>
        </div>
        {dirtyItinerary.summary && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{dirtyItinerary.summary}</p>
        )}
      </div>

      {/* 视图切换按钮组 */}
      <div className="flex items-center gap-2 px-5 py-2 border-b border-zinc-100 dark:border-zinc-700">
        <button
          onClick={() => setViewMode('timeline')}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            viewMode === 'timeline'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
              : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700'
          }`}
        >
          时间轴
        </button>
        <button
          onClick={() => setViewMode('map')}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            viewMode === 'map'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
              : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700'
          }`}
        >
          地图
        </button>
      </div>

      {/* Day Timeline / Map View */}
      {viewMode === 'timeline' ? (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
          {dirtyItinerary.days.map(day => (
            <DaySection
              key={day.dayNumber}
              day={day}
              flightGroups={flightGroups}
              hotelCandidates={hotelCandidates}
              flightOverrides={effectiveFlightOverrides}
              hotelOverrides={hotelOverrides}
              destinationCity={destinationCity}
              aircraftMap={aircraftMap}
              onFlightSwitch={handleFlightSwitch}
              onHotelSwitch={handleHotelSwitch}
              isLoggedIn={!!user}
              isEditing={isEditing}
            />
          ))}
        </div>
      ) : (
        <div className="px-5 py-4">
          {/* 日期选择器 */}
          <div className="flex gap-2 mb-3 overflow-x-auto">
            {dirtyItinerary.days.map((day, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedDay(idx)}
                className={`shrink-0 px-3 py-1 text-xs rounded-full transition-colors ${
                  selectedDay === idx
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300'
                }`}
              >
                Day {day.dayNumber}
              </button>
            ))}
          </div>
          {/* 地图 */}
          <div className="h-80 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
            <MapViewer days={dirtyItinerary.days} selectedDay={selectedDay} />
          </div>
        </div>
      )}

      {/* Tips */}
      {dirtyItinerary.tips && dirtyItinerary.tips.length > 0 && (
        <div className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-700">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">出行提示</p>
          <ul className="space-y-0.5">
            {dirtyItinerary.tips.map((tip, i) => (
              <li key={i} className="text-xs text-zinc-500 dark:text-zinc-400">• {tip}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer: 飞书发送按钮 */}
      <div className="border-t border-zinc-100 px-5 py-4 dark:border-zinc-700">
        {!user ? (
          <button
            disabled
            className="w-full rounded-lg bg-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-500 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-400"
          >
            请先登录飞书以发送行程
          </button>
        ) : sendStatus === 'sent' ? (
          <button
            disabled
            className="w-full rounded-lg bg-green-100 px-4 py-2.5 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400"
          >
            已发送至飞书
          </button>
        ) : (
          <div>
            <button
              onClick={handleSendToFeishu}
              disabled={sendStatus === 'sending'}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {sendStatus === 'sending' ? '发送中...' : '确认行程并发送至我的飞书'}
            </button>
            {sendStatus === 'error' && sendError && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{sendError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Day Section ---

function DaySection({
  day,
  flightGroups,
  hotelCandidates,
  flightOverrides,
  hotelOverrides,
  destinationCity,
  aircraftMap,
  onFlightSwitch,
  onHotelSwitch,
  isLoggedIn,
  isEditing,
}: {
  day: Itinerary['days'][number];
  flightGroups: FlightCandidateGroup[];
  hotelCandidates: HotelCandidate[];
  flightOverrides: Record<string, FlightData>;
  hotelOverrides: Record<string, HotelCandidate>;
  destinationCity: string;
  aircraftMap: Record<string, string>;
  onFlightSwitch: (activityId: string, flight: FlightData) => void;
  onHotelSwitch: (activityId: string, hotel: HotelCandidate) => void;
  isLoggedIn: boolean;
  isEditing: boolean;
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {day.dayNumber}
        </span>
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {day.date}
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {day.theme}
        </span>
      </div>

      <div className="ml-3 border-l-2 border-zinc-200 pl-4 space-y-3 dark:border-zinc-600">
        {day.activities.map(activity => (
          <ActivityRow
            key={activity.id}
            activity={activity}
            date={day.date}
            flightGroups={flightGroups}
            hotelCandidates={hotelCandidates}
            flightOverride={flightOverrides[activity.id]}
            hotelOverride={hotelOverrides[activity.id]}
            destinationCity={destinationCity}
            aircraftMap={aircraftMap}
            onFlightSwitch={onFlightSwitch}
            onHotelSwitch={onHotelSwitch}
            isLoggedIn={isLoggedIn}
            isEditing={isEditing}
          />
        ))}
      </div>
    </div>
  );
}

// --- Activity Row ---

const ACTIVITY_ICONS: Record<string, string> = {
  flight: '✈️',
  transport: '🚗',
  attraction: '🏛️',
  meal: '🍽️',
  hotel: '🏨',
  meeting: '💼',
  free_time: '☕',
};

function ActivityRow({
  activity,
  date,
  flightGroups,
  hotelCandidates,
  flightOverride,
  hotelOverride,
  destinationCity,
  aircraftMap,
  onFlightSwitch,
  onHotelSwitch,
  isLoggedIn,
  isEditing,
}: {
  activity: Activity;
  date: string;
  flightGroups: FlightCandidateGroup[];
  hotelCandidates: HotelCandidate[];
  flightOverride?: FlightData;
  hotelOverride?: HotelCandidate;
  destinationCity: string;
  aircraftMap: Record<string, string>;
  onFlightSwitch: (activityId: string, flight: FlightData) => void;
  onHotelSwitch: (activityId: string, hotel: HotelCandidate) => void;
  isLoggedIn: boolean;
  isEditing: boolean;
}) {
  const [calendarStatus, setCalendarStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [isAuthExpired, setIsAuthExpired] = useState(false);

  const handleAddToCalendar = async () => {
    setCalendarStatus('sending');
    setCalendarError(null);
    setIsAuthExpired(false);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/feishu/calendar-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          startTime: activity.time,
          endTime: activity.endTime || undefined,
          title: activity.title,
          description: activity.description || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCalendarStatus('sent');
      } else {
        const errMsg = data.error || '添加失败';
        const authExpired = res.status === 401 || /过期|重新登录|token.*invalid|unauthorized/i.test(errMsg);
        setCalendarStatus('error');
        setCalendarError(authExpired ? '授权已过期，请重新登录飞书' : errMsg);
        setIsAuthExpired(authExpired);
      }
    } catch (err) {
      setCalendarStatus('error');
      setCalendarError(err instanceof Error ? err.message : '网络错误');
      setIsAuthExpired(false);
    }
  };

  const icon = ACTIVITY_ICONS[activity.type] || '📍';
  const timeStr = activity.endTime
    ? `${activity.time} - ${activity.endTime}`
    : activity.time;

  const relevantGroups = activity.type === 'flight' && activity.flight
    ? flightGroups.filter(group => {
        return (
          group.departureCity.includes(activity.flight!.departureCity) ||
          activity.flight!.departureCity.includes(group.departureCity)
        ) && (
          group.arrivalCity.includes(activity.flight!.arrivalCity) ||
          activity.flight!.arrivalCity.includes(group.arrivalCity)
        );
      })
    : flightGroups;

  return (
    <div className="relative">
      {/* 时间线圆点 */}
      <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-blue-400 bg-white dark:border-blue-500 dark:bg-zinc-800" />

      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{icon}</span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">{timeStr}</span>
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{activity.title}</span>
          {/* 添加至飞书日历按钮 */}
          {isLoggedIn && (
            <button
              onClick={handleAddToCalendar}
              disabled={calendarStatus === 'sending'}
              title={calendarStatus === 'error' && calendarError ? calendarError : calendarStatus === 'sent' ? '已添加至飞书日历' : '添加至飞书日历'}
              className={`ml-auto shrink-0 p-1 rounded transition-colors ${
                calendarStatus === 'idle'
                  ? 'text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:text-zinc-500 dark:hover:text-blue-400 dark:hover:bg-blue-900/30'
                  : calendarStatus === 'sending'
                  ? 'text-zinc-300 dark:text-zinc-600 animate-pulse'
                  : calendarStatus === 'sent'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300'
              }`}
            >
              {calendarStatus === 'idle' && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1.5 5.5a1.25 1.25 0 100 2.5h11a1.25 1.25 0 100-2.5h-11z" clipRule="evenodd" />
                </svg>
              )}
              {calendarStatus === 'sending' && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1.5 5.5a1.25 1.25 0 100 2.5h11a1.25 1.25 0 100-2.5h-11z" clipRule="evenodd" />
                </svg>
              )}
              {calendarStatus === 'sent' && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              )}
              {calendarStatus === 'error' && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          )}
          {calendarStatus === 'error' && calendarError && (
            <span className={`text-xs ${isAuthExpired ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}`}>
              {calendarError}
            </span>
          )}
        </div>

        {activity.description && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 pl-6">{activity.description}</p>
        )}

        {/* 航班切换器 */}
        {activity.type === 'flight' && activity.flight && (
          <div className="pl-6 mt-1">
            <FlightSwitcher
              activityId={activity.id}
              currentFlight={activity.flight}
              candidates={relevantGroups}
              currentOverride={flightOverride}
              onSwitch={(flight) => onFlightSwitch(activity.id, flight)}
              aircraftMap={aircraftMap}
              disabled={!isEditing}
            />
          </div>
        )}

        {/* 酒店切换器 */}
        {activity.type === 'hotel' && (
          <div className="pl-6 mt-1">
            <HotelSwitcher
              activityId={activity.id}
              currentHotelName={hotelOverride?.name || activity.title}
              currentAddress={activity.location?.address}
              city={destinationCity}
              initialCandidates={hotelCandidates}
              currentOverride={hotelOverride}
              onSwitch={(hotel) => onHotelSwitch(activity.id, hotel)}
              disabled={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}

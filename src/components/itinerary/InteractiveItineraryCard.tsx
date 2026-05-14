'use client';

import { useState, useMemo, useCallback } from 'react';
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
}

export function InteractiveItineraryCard({ itinerary, flightGroups, hotelCandidates }: Props) {
  const { user } = useFeishuUser();
  const [flightOverrides, setFlightOverrides] = useState<Record<string, FlightData>>({});
  const [hotelOverrides, setHotelOverrides] = useState<Record<string, HotelCandidate>>({});
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [sendError, setSendError] = useState<string | null>(null);
  const [calendarWarning, setCalendarWarning] = useState<string | null>(null);

  // 获取目的地城市用于酒店搜索
  const destinationCity = itinerary.destination.name;

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
            price: activity.flight?.price,
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
    setFlightOverrides(prev => ({ ...prev, [activityId]: flight }));
  }, []);

  const handleHotelSwitch = useCallback((activityId: string, hotel: HotelCandidate) => {
    setHotelOverrides(prev => ({ ...prev, [activityId]: hotel }));
  }, []);

  const handleSendToFeishu = async () => {
    if (!user?.openId) return;
    setSendStatus('sending');
    setSendError(null);
    setCalendarWarning(null);

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
        if (data.calendarError) {
          setCalendarWarning(data.calendarError);
        }
      } else {
        throw new Error(data.error || '发送失败');
      }
    } catch (err) {
      setSendStatus('error');
      setSendError(err instanceof Error ? err.message : '发送失败');
    }
  };

  // 预算
  const budget = dirtyItinerary.estimatedBudget;

  return (
    <div className="w-full rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden dark:border-zinc-700 dark:bg-zinc-800">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 dark:from-blue-950/30 dark:to-indigo-950/30">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          {dirtyItinerary.title}
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {dirtyItinerary.startDate} ~ {dirtyItinerary.endDate}
        </p>
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

      {/* Day Timeline */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
        {dirtyItinerary.days.map(day => (
          <DaySection
            key={day.dayNumber}
            day={day}
            flightGroups={flightGroups}
            hotelCandidates={hotelCandidates}
            flightOverrides={flightOverrides}
            hotelOverrides={hotelOverrides}
            destinationCity={destinationCity}
            onFlightSwitch={handleFlightSwitch}
            onHotelSwitch={handleHotelSwitch}
          />
        ))}
      </div>

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
          <div>
            <button
              disabled
              className="w-full rounded-lg bg-green-100 px-4 py-2.5 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400"
            >
              已发送至飞书
            </button>
            {calendarWarning && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                {calendarWarning}
              </p>
            )}
          </div>
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
  onFlightSwitch,
  onHotelSwitch,
}: {
  day: Itinerary['days'][number];
  flightGroups: FlightCandidateGroup[];
  hotelCandidates: HotelCandidate[];
  flightOverrides: Record<string, FlightData>;
  hotelOverrides: Record<string, HotelCandidate>;
  destinationCity: string;
  onFlightSwitch: (activityId: string, flight: FlightData) => void;
  onHotelSwitch: (activityId: string, hotel: HotelCandidate) => void;
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
            flightGroups={flightGroups}
            hotelCandidates={hotelCandidates}
            flightOverride={flightOverrides[activity.id]}
            hotelOverride={hotelOverrides[activity.id]}
            destinationCity={destinationCity}
            onFlightSwitch={onFlightSwitch}
            onHotelSwitch={onHotelSwitch}
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
  flightGroups,
  hotelCandidates,
  flightOverride,
  hotelOverride,
  destinationCity,
  onFlightSwitch,
  onHotelSwitch,
}: {
  activity: Activity;
  flightGroups: FlightCandidateGroup[];
  hotelCandidates: HotelCandidate[];
  flightOverride?: FlightData;
  hotelOverride?: HotelCandidate;
  destinationCity: string;
  onFlightSwitch: (activityId: string, flight: FlightData) => void;
  onHotelSwitch: (activityId: string, hotel: HotelCandidate) => void;
}) {
  const icon = ACTIVITY_ICONS[activity.type] || '📍';
  const timeStr = activity.endTime
    ? `${activity.time} - ${activity.endTime}`
    : activity.time;

  return (
    <div className="relative">
      {/* 时间线圆点 */}
      <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-blue-400 bg-white dark:border-blue-500 dark:bg-zinc-800" />

      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{icon}</span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">{timeStr}</span>
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{activity.title}</span>
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
              candidates={flightGroups}
              currentOverride={flightOverride}
              onSwitch={(flight) => onFlightSwitch(activity.id, flight)}
            />
          </div>
        )}

        {/* 酒店切换器 */}
        {activity.type === 'hotel' && (
          <div className="pl-6 mt-1">
            <HotelSwitcher
              activityId={activity.id}
              currentHotelName={hotelOverride?.name || activity.title}
              city={destinationCity}
              initialCandidates={hotelCandidates}
              currentOverride={hotelOverride}
              onSwitch={(hotel) => onHotelSwitch(activity.id, hotel)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

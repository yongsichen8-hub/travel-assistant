'use client';

import type { FlightInfo } from '@/lib/types/itinerary';
import type { FlightData } from '@/components/ui/FlightCard';
import type { FlightCandidateGroup } from '@/lib/types/itinerary-card';

interface Props {
  activityId: string;
  currentFlight: FlightInfo;
  candidates: FlightCandidateGroup[];
  currentOverride?: FlightData;
  onSwitch: (flight: FlightData) => void;
  aircraftMap?: Record<string, string>;
}

export function FlightSwitcher({ currentFlight, candidates, currentOverride, onSwitch, aircraftMap }: Props) {
  const hasCandidates = candidates.some(g => g.flights.length > 0);

  // 当前展示的航班（优先覆盖值）
  const displayFlight = currentOverride
    ? {
        flightNo: currentOverride.flightNo,
        airline: currentOverride.airline,
        departureTime: currentOverride.departureTime,
        arrivalTime: currentOverride.arrivalTime,
        departureAirport: currentOverride.departureAirport,
        arrivalAirport: currentOverride.arrivalAirport,
      }
    : {
        flightNo: currentFlight.flightNo,
        airline: currentFlight.airline,
        departureTime: currentFlight.departureTime,
        arrivalTime: currentFlight.arrivalTime,
        departureAirport: '',
        arrivalAirport: '',
      };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [groupIdx, flightIdx] = e.target.value.split('-').map(Number);
    const group = candidates[groupIdx];
    if (group) {
      const flight = group.flights[flightIdx];
      if (flight) onSwitch(flight);
    }
  };

  // 构建当前选中值的 key
  const currentKey = (() => {
    for (let gi = 0; gi < candidates.length; gi++) {
      const group = candidates[gi];
      for (let fi = 0; fi < group.flights.length; fi++) {
        const f = group.flights[fi];
        if (f.flightNo === displayFlight.flightNo && f.departureTime === displayFlight.departureTime) {
          return `${gi}-${fi}`;
        }
      }
    }
    return '';
  })();

  const DIRECTION_LABELS: Record<string, string> = {
    outbound: '去程',
    return: '返程',
    unknown: '航班',
  };

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-2.5 dark:border-blue-900/50 dark:bg-blue-950/20">
      {/* 当前航班信息 */}
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium text-blue-700 dark:text-blue-400">
          {displayFlight.airline} {displayFlight.flightNo}
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">
          {displayFlight.departureTime} - {displayFlight.arrivalTime}
        </span>
        {displayFlight.departureAirport && (
          <span className="text-zinc-400 dark:text-zinc-500">
            {displayFlight.departureAirport}→{displayFlight.arrivalAirport}
          </span>
        )}
      </div>

      {/* 下拉选择器 */}
      {hasCandidates && (
        <select
          value={currentKey}
          onChange={handleChange}
          className="mt-1.5 w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
        >
          <option value="" disabled>切换航班...</option>
          {candidates.map((group, gi) => (
            <optgroup key={gi} label={`${DIRECTION_LABELS[group.direction]} ${group.departureCity}→${group.arrivalCity} ${group.date}`}>
              {group.flights.slice(0, 15).map((f, fi) => {
                  // 构造 option 文本
                  let optionText = `[${f.departureTime}-${f.arrivalTime}] ${f.flightNo} | ${f.airline}`;
                  if (f.price && f.price > 0) {
                    optionText += ` | ¥${f.price}`;
                  }
                  if (f.stops !== undefined) {
                    optionText += ` | ${f.stops === 0 ? '直飞' : `经停${f.stops}`}`;
                  }
                  if (aircraftMap && aircraftMap[f.flightNo]) {
                    optionText += ` | ${aircraftMap[f.flightNo]}`;
                  }
                  return (
                    <option key={`${gi}-${fi}`} value={`${gi}-${fi}`}>
                      {optionText}
                    </option>
                  );
                })}
            </optgroup>
          ))}
        </select>
      )}
    </div>
  );
}

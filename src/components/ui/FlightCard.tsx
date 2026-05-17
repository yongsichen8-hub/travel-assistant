'use client';

interface FlightData {
  flightNo: string;
  airline: string;
  departureTime: string;
  arrivalTime: string;
  departureAirport: string;
  arrivalAirport: string;
  duration: string;
  departureCity: string;
  arrivalCity: string;
  price?: number;
  stops?: number;
  cabinClass?: string;
}

export { type FlightData };

export function FlightCard({ flight, onSelect }: { flight: FlightData; onSelect?: (flight: FlightData) => void }) {
  const clickable = !!onSelect;

  return (
    <div
      onClick={() => onSelect?.(flight)}
      className={`group relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800 ${
        clickable ? 'cursor-pointer hover:border-blue-300 hover:ring-1 hover:ring-blue-200 dark:hover:border-blue-600 dark:hover:ring-blue-900' : ''
      }`}
    >  {/* 航司信息 */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30">
          <svg className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0011.5 2 1.5 1.5 0 0010 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
          </svg>
        </div>
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
          {flight.airline}
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {flight.flightNo}
        </span>
      </div>

      {/* 时间 + 航线主体 */}
      <div className="flex items-center justify-between">
        {/* 出发 */}
        <div className="text-left">
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {flight.departureTime}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {flight.departureAirport || flight.departureCity}
          </div>
        </div>

        {/* 中间连接线 */}
        <div className="flex flex-1 flex-col items-center px-3">
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
            {flight.duration}
          </span>
          <div className="relative my-1 h-px w-full bg-zinc-200 dark:bg-zinc-600">
            <div className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-zinc-300 dark:bg-zinc-500" />
            <svg
              className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-blue-500"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0011.5 2 1.5 1.5 0 0010 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
            </svg>
            <div className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-zinc-300 dark:bg-zinc-500" />
          </div>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            直飞
          </span>
        </div>

        {/* 到达 */}
        <div className="text-right">
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {flight.arrivalTime}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {flight.arrivalAirport || flight.arrivalCity}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 从 search_flights 工具返回的文本结果中解析航班数据
 */
export function parseFlightsFromToolResult(result: unknown): FlightData[] {
  if (typeof result !== 'string') return [];
  // 新格式: "ZH1386 | 深圳航空 | 06:25-09:35 | 白云-首都 | ¥680 | 直飞"
  // 旧格式: "ZH1386 | 深圳航空 | 06:25-09:35 | 白云-首都"
  const lines = result.split('\n');
  const flights: FlightData[] = [];

  for (const line of lines) {
    const parts = line.split(' | ');
    if (parts.length < 4) continue;

    const [flightNo, airline, timeRange, airports] = parts;
    const times = timeRange.split('-');
    const airportPair = airports.split('-');

    if (times.length !== 2 || airportPair.length !== 2) continue;

    // 新增字段（可选，向后兼容）
    let price: number | undefined;
    let stops: number | undefined;

    if (parts.length >= 5 && parts[4].startsWith('¥')) {
      price = parseInt(parts[4].replace('¥', ''), 10);
      if (isNaN(price)) price = undefined;
    }
    if (parts.length >= 6) {
      stops = parts[5] === '直飞' ? 0 : parseInt(parts[5].replace('经停', ''), 10);
      if (isNaN(stops)) stops = undefined;
    }

    flights.push({
      flightNo: flightNo.trim(),
      airline: airline.trim(),
      departureTime: times[0].trim(),
      arrivalTime: times[1].trim(),
      departureAirport: airportPair[0].trim(),
      arrivalAirport: airportPair[1].trim(),
      duration: '',
      departureCity: '',
      arrivalCity: '',
      price,
      stops,
    });
  }

  // 计算 duration
  for (const f of flights) {
    if (f.departureTime && f.arrivalTime) {
      const [dh, dm] = f.departureTime.split(':').map(Number);
      const [ah, am] = f.arrivalTime.split(':').map(Number);
      let diffMin = (ah * 60 + am) - (dh * 60 + dm);
      if (diffMin < 0) diffMin += 24 * 60; // 跨日
      const h = Math.floor(diffMin / 60);
      const m = diffMin % 60;
      f.duration = h > 0 ? `${h}h${m > 0 ? m + 'm' : ''}` : `${m}m`;
    }
  }

  return flights;
}

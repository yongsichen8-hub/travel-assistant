/**
 * 阿里云 API 市场 — 航班查询客户端
 *
 * 接口: GET https://plane.market.alicloudapi.com/ai_market/ai_airplane/get_airplane_info_by_cities
 * 认证: Header Authorization: APPCODE {appcode}
 * 参数: START_CITY, END_CITY, DATE (yyyyMMdd), START_AIRLINE, END_AIRLINE
 */

import type { FlightSearchParams, FlightResult } from './types';

const API_URL = 'https://plane.market.alicloudapi.com/ai_market/ai_airplane/get_airplane_info_by_cities';

function getAppCode(): string {
  const code = (process.env.ALIYUN_FLIGHT_APPCODE || '').trim();
  if (!code) throw new Error('ALIYUN_FLIGHT_APPCODE 未配置');
  return code;
}

/** yyyy-MM-dd → yyyyMMdd */
function formatDate(date: string): string {
  return date.replace(/-/g, '');
}

/** 20260508070000 → 07:00 */
function formatTime(raw: string): string {
  if (!raw || raw.length < 12) return '';
  return `${raw.slice(8, 10)}:${raw.slice(10, 12)}`;
}

/** 计算两个 yyyyMMddHHmmss 时间之间的时长 */
function calcDuration(startRaw: string, endRaw: string): string {
  if (!startRaw || !endRaw || startRaw.length < 12 || endRaw.length < 12) return '';
  const s = new Date(
    +startRaw.slice(0, 4), +startRaw.slice(4, 6) - 1, +startRaw.slice(6, 8),
    +startRaw.slice(8, 10), +startRaw.slice(10, 12),
  );
  const e = new Date(
    +endRaw.slice(0, 4), +endRaw.slice(4, 6) - 1, +endRaw.slice(6, 8),
    +endRaw.slice(8, 10), +endRaw.slice(10, 12),
  );
  const diffMin = Math.round((e.getTime() - s.getTime()) / 60000);
  if (diffMin <= 0) return '';
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return h > 0 ? `${h}h${m > 0 ? m + 'min' : ''}` : `${m}min`;
}

interface AliyunFlightItem {
  FLIGHT_ID?: string;
  FLIGHT_AIRWAYS_CH?: string;
  START_AIRPORT_CH?: string;
  START_AIRPORT_EN?: string;
  START_CITY?: string;
  START_TIME?: string;
  START_TERMINAL_EN?: string;
  END_AIRPORT_CH?: string;
  END_AIRPORT_EN?: string;
  END_CITY?: string;
  END_TIME?: string;
  END_TERMINAL_EN?: string;
}

/**
 * 搜索航班 — 调用阿里云 API 市场接口
 * 返回全量去重后的航班（去除代码共享重复），按起飞时间排序
 */
export async function searchFlights(params: FlightSearchParams): Promise<{ flights: FlightResult[] }> {
  const { departure_city, arrival_city, date } = params;

  try {
    const appCode = getAppCode();

    const url = new URL(API_URL);
    url.searchParams.set('START_CITY', departure_city);
    url.searchParams.set('END_CITY', arrival_city);
    url.searchParams.set('DATE', formatDate(date));
    url.searchParams.set('START_AIRLINE', departure_city);
    url.searchParams.set('END_AIRLINE', arrival_city);

    console.log('【1. 发给阿里云的完整URL】:', url.toString());
    console.log('【1. 原始入参】:', JSON.stringify({ departure_city, arrival_city, date, dateFormatted: formatDate(date) }));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `APPCODE ${appCode}`,
      },
      signal: AbortSignal.timeout(15000),
    });

    const rawText = await response.text();
    console.log('【2. 阿里云原始返回 HTTP状态】:', response.status);
    console.log('【2. 阿里云原始返回】:', rawText.substring(0, 800));

    if (!response.ok) {
      console.error(`[Flight] API请求失败 - 状态码: ${response.status}`);
      return { flights: [] };
    }

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('【3. 解析航班失败】: JSON.parse 失败:', parseErr);
      return { flights: [] };
    }

    console.log('【2. 返回顶层字段】:', Object.keys(result));
    console.log('【2. TOTAL_AIRLINES】:', result.TOTAL_AIRLINES);
    console.log('【2. JOURNEY_DETAIL是否数组】:', Array.isArray(result.JOURNEY_DETAIL), '长度:', Array.isArray(result.JOURNEY_DETAIL) ? (result.JOURNEY_DETAIL as unknown[]).length : 'N/A');

    const journeyDetail: AliyunFlightItem[] = result?.JOURNEY_DETAIL as AliyunFlightItem[];
    if (!Array.isArray(journeyDetail) || journeyDetail.length === 0) {
      console.error('【3. 解析航班失败】: JOURNEY_DETAIL 为空或不是数组, 完整结构:', rawText.substring(0, 500));
      return { flights: [] };
    }

    console.log('【2. 首条航班样例】:', JSON.stringify(journeyDetail[0]));

    // 转换 + 去重（同一 departure time + arrival time 只保留主航班号）
    const seen = new Set<string>();
    const flights: FlightResult[] = [];

    for (const item of journeyDetail) {
      const flightNo = item.FLIGHT_ID || '';
      if (!flightNo) continue;

      // 去重：相同起降时间 + 航线视为代码共享
      const dedupeKey = `${item.START_TIME}-${item.END_TIME}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const depTime = formatTime(item.START_TIME || '');
      const arrTime = formatTime(item.END_TIME || '');
      const duration = calcDuration(item.START_TIME || '', item.END_TIME || '');

      flights.push({
        flightNo,
        airline: item.FLIGHT_AIRWAYS_CH || flightNo.slice(0, 2),
        departureCity: item.START_CITY || departure_city,
        arrivalCity: item.END_CITY || arrival_city,
        departureAirport: item.START_AIRPORT_CH || '',
        arrivalAirport: item.END_AIRPORT_CH || '',
        departureTime: depTime,
        arrivalTime: arrTime,
        duration,
        price: 0,
        cabinClass: 'economy',
        aircraft: '',
      });
    }

    return { flights };
  } catch (err) {
    console.error('【3. 解析航班失败】: 致命异常:', err);
    return { flights: [] };
  }
}

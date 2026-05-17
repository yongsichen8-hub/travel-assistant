/**
 * 飞常准（VariFlight）航班时刻表适配器
 *
 * 端点: GET https://open-al.variflight.com/api/flight
 * 协议: REST GET
 * 认证: Bearer Token
 *
 * 飞常准提供企业级航班时刻表数据，不提供价格。
 * 价格由飞猪辅助补价。
 */

import type { FlightSearchParams, FlightResult } from '../types';
import { iataToAirportName } from '../airports';

// ─── 常量 ───

const VARIFLIGHT_API_KEY = process.env.VARIFLIGHT_API_KEY || '';
const API_BASE_URL = 'https://open-al.variflight.com/api/flight';
const TIMEOUT_MS = 15_000;

/**
 * 飞常准城市→IATA三字码映射
 * 复用项目中 airports.ts 的映射，此表作为补充 / 降级
 */
const CITY_TO_IATA: Record<string, string> = {
  // 国内
  '北京': 'PEK', '上海': 'SHA', '广州': 'CAN', '深圳': 'SZX',
  '成都': 'CTU', '杭州': 'HGH', '南京': 'NKG', '武汉': 'WUH',
  '西安': 'XIY', '重庆': 'CKG', '昆明': 'KMG', '厦门': 'XMN',
  '长沙': 'CSX', '青岛': 'TAO', '大连': 'DLC', '天津': 'TSN',
  '郑州': 'CGO', '海口': 'HAK', '三亚': 'SYX', '福州': 'FOC',
  '贵阳': 'KWE', '南宁': 'NNG', '兰州': 'LHW', '太原': 'TYN',
  '哈尔滨': 'HRB', '沈阳': 'SHE', '乌鲁木齐': 'URC', '拉萨': 'LXA',
  '珠海': 'ZUH', '合肥': 'HFE', '南昌': 'KHN', '石家庄': 'SJW',
  // 港澳台
  '香港': 'HKG', '澳门': 'MFM', '台北': 'TPE',
};

// ─── 工具函数 ───

/**
 * 城市名转 IATA 三字码
 * - 已是三字码（全大写字母）→ 直接返回
 * - 中文城市名 → 查本地映射表
 */
function cityToIATACode(city: string): string {
  if (/^[A-Z]{3}$/.test(city)) return city;
  return CITY_TO_IATA[city] || city;
}

/**
 * 从航班号提取航司名
 */
function extractAirline(flightNo: string): string {
  const code = flightNo.substring(0, 2);
  const airlines: Record<string, string> = {
    'CA': '国航', 'MU': '东航', 'CZ': '南航', 'HU': '海航',
    'ZH': '深航', 'MF': '厦航', 'FM': '上航', '3U': '川航',
    'SC': '山航', 'GS': '天津航空', 'KN': '中联航', 'AQ': '九元航空',
    'GJ': '长龙航空', 'PN': '西部航空', 'TV': '西藏航空',
    'NS': '河北航空', 'EU': '成都航空', 'G5': '华夏航空',
    'JR': '幸福航空', 'DR': '瑞丽航空', 'KY': '昆明航空',
    'Y8': '扬子江航空', 'OQ': '重庆航空',
  };
  return airlines[code] || code;
}

/**
 * 格式化时间为 HH:MM
 * 处理各种格式：'08:30', '2026-05-21 08:30:00', '0830' 等
 */
function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  if (timeStr.includes(':')) {
    const parts = timeStr.split(' ');
    const time = parts.length > 1 ? parts[1] : parts[0];
    return time.substring(0, 5);
  }
  if (timeStr.length === 4 && /^\d{4}$/.test(timeStr)) {
    return timeStr.substring(0, 2) + ':' + timeStr.substring(2, 4);
  }
  return timeStr;
}

// ─── 请求构造 ───

/**
 * 构造请求 headers（仅 Authorization）
 */
function buildHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${VARIFLIGHT_API_KEY}`,
  };
}

// ─── 主函数 ───

/**
 * 从飞常准 REST API 获取航班时刻表数据
 *
 * @param params 标准航班搜索参数
 * @returns FlightResult[] 数据源标记为 'variflight'，price=0（需飞猪补价）
 */
export async function fetchVariflightFlights(
  params: FlightSearchParams,
): Promise<FlightResult[]> {
  if (!VARIFLIGHT_API_KEY) {
    console.log('[VariFlight] ⚠️ 未配置 VARIFLIGHT_API_KEY，跳过');
    return [];
  }

  const dep = cityToIATACode(params.departure_city);
  const arr = cityToIATACode(params.arrival_city);
  // 日期格式：YYYY-MM-DD（保留连字符）
  const date = params.date;

  // 构造 REST GET URL
  const queryParams = new URLSearchParams({ dep, arr, date });
  const url = `${API_BASE_URL}?${queryParams.toString()}`;
  const headers = buildHeaders();

  console.log(`[VariFlight] 请求航班: ${params.departure_city}(${dep}) → ${params.arrival_city}(${arr}), 日期: ${date}`);
  console.log('[VariFlight] 请求 URL:', url);
  console.log('[VariFlight] 请求 Headers:', JSON.stringify(headers, null, 2));

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    console.log('[VariFlight] HTTP Status:', response.status);

    // HTTP 层面错误
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[VariFlight] HTTP 错误: ${response.status} | body: ${errorText.substring(0, 300)}`);
      return [];
    }

    // 直接解析 REST JSON 响应
    const json = await response.json();
    console.log('[VariFlight] 响应体(前500):', JSON.stringify(json).substring(0, 500));

    // 兼容多种响应结构：data 数组、flightList 数组、直接数组
    const flights: any[] = Array.isArray(json)
      ? json
      : json?.data || json?.flightList || [];

    if (!Array.isArray(flights) || flights.length === 0) {
      console.log(`[VariFlight] 无航班数据，原始响应结构 keys: ${json ? Object.keys(json) : 'null'}`);
      return [];
    }

    console.log(`[VariFlight] 获取到 ${flights.length} 趟航班`);

    // 映射为标准 FlightResult[]
    const results: FlightResult[] = flights.map((f: any) => ({
      flightNo: f.flightNo || f.FlightNo || '',
      airline: f.airlineName || f.AirlineName || extractAirline(f.flightNo || f.FlightNo || ''),
      departureTime: formatTime(f.depScheduledTime || f.DepTime || f.depPlanTime || ''),
      arrivalTime: formatTime(f.arrScheduledTime || f.ArrTime || f.arrPlanTime || ''),
      departureCity: params.departure_city,
      arrivalCity: params.arrival_city,
      departureAirport: f.depAirportName || f.DepAirport || iataToAirportName(dep),
      arrivalAirport: f.arrAirportName || f.ArrAirport || iataToAirportName(arr),
      price: 0, // 飞常准不提供价格，由飞猪补价
      stops: f.stopCount || 0,
      duration: f.duration || '',
      aircraft: f.aircraftType || f.FlightType || '',
      cabinClass: 'economy',
      source: 'variflight',
      currency: 'CNY' as const,
    })).filter((f: FlightResult) => f.flightNo); // 过滤无效数据

    return results;
  } catch (error: any) {
    // 网络错误 / 超时
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[VariFlight] 请求超时 (15s)');
    } else {
      console.error('[VariFlight] 请求异常:', error.message || error);
    }
    return [];
  }
}

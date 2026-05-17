/**
 * RapidAPI Flights Scraper Sky 适配器
 *
 * 端点: GET https://flights-sky.p.rapidapi.com/flights/search-one-way
 * 认证: x-rapidapi-key header
 *
 * 响应格式参考 Skyscanner 数据结构:
 * { data: { itineraries: [{ price: { raw }, legs: [{ origin, destination, departure, arrival, ... }] }] } }
 */

import type { FlightSearchParams, FlightResult } from '../types';
import { cityToIATA, iataToCity, iataToAirportName } from '../airports';

// ─── 常量 ───

const API_HOST = 'flights-sky.p.rapidapi.com';
const SEARCH_ONE_WAY_URL = `https://${API_HOST}/flights/search-one-way`;
const AUTO_COMPLETE_URL = `https://${API_HOST}/flights/auto-complete`;
const TIMEOUT_MS = 15_000;

/**
 * 中文城市名 → IATA 三字码映射表
 * 优先使用 airports.ts 中的 cityToIATA，此表作为补充 / 降级
 */
const CITY_TO_IATA: Record<string, string> = {
  // 国内
  '北京': 'PEK', '上海': 'PVG', '广州': 'CAN', '深圳': 'SZX',
  '成都': 'CTU', '杭州': 'HGH', '南京': 'NKG', '武汉': 'WUH',
  '西安': 'XIY', '重庆': 'CKG', '昆明': 'KMG', '厦门': 'XMN',
  '长沙': 'CSX', '青岛': 'TAO', '大连': 'DLC', '天津': 'TSN',
  '郑州': 'CGO', '海口': 'HAK', '三亚': 'SYX', '福州': 'FOC',
  '贵阳': 'KWE', '南宁': 'NNG', '兰州': 'LHW', '太原': 'TYN',
  '哈尔滨': 'HRB', '沈阳': 'SHE', '乌鲁木齐': 'URC', '拉萨': 'LXA',
  '珠海': 'ZUH', '合肥': 'HFE', '南昌': 'KHN', '石家庄': 'SJW',
  // 国际
  '东京': 'NRT', '首尔': 'ICN', '新加坡': 'SIN', '曼谷': 'BKK',
  '伦敦': 'LHR', '纽约': 'JFK', '洛杉矶': 'LAX', '巴黎': 'CDG',
  '悉尼': 'SYD', '迪拜': 'DXB', '吉隆坡': 'KUL', '香港': 'HKG',
};

// ─── 工具函数 ───

/**
 * 将城市名解析为 IATA 三字码
 * - 已是三字码（全大写字母）→ 直接返回
 * - 中文城市名 → 先查 airports.ts，再查本地映射表
 */
function resolveIATA(cityName: string): string | null {
  if (/^[A-Z]{3}$/.test(cityName)) {
    return cityName;
  }
  const fromAirports = cityToIATA(cityName);
  if (fromAirports.length > 0) {
    return fromAirports[0];
  }
  return CITY_TO_IATA[cityName] ?? null;
}

/** ISO 时间 → HH:mm */
function toHHMM(isoStr: string): string {
  if (!isoStr) return '';
  const slice = isoStr.slice(11, 16);
  if (/^\d{2}:\d{2}$/.test(slice)) return slice;
  try {
    return new Date(isoStr).toTimeString().slice(0, 5);
  } catch {
    return '';
  }
}

/** 分钟数 → "XhYmin" */
function formatDuration(minutes: number): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m}min` : `${h}h`;
}

/** 从 leg 中提取航班号 */
function extractFlightNo(leg: any, fallbackIdx: number): string {
  // 尝试从 segments 提取
  if (Array.isArray(leg.segments) && leg.segments.length > 0) {
    const seg = leg.segments[0];
    if (seg.flightNumber) {
      const carrierCode = seg.operatingCarrier?.code ?? seg.marketingCarrier?.code ?? '';
      return carrierCode ? `${carrierCode}${seg.flightNumber}` : String(seg.flightNumber);
    }
  }
  // 尝试从 leg.id 提取
  if (leg.id) {
    const match = leg.id.match(/([A-Z0-9]{2}\d{1,4})/);
    if (match) return match[1];
  }
  return `RAP${String(fallbackIdx).padStart(4, '0')}`;
}

// ─── 机场查询 ───

interface AirportInfo {
  skyId: string;
  entityId: string;
  cityName?: string;
}

/**
 * 调用 auto-complete 端点获取地点的 skyId 和 entityId
 * 这些 ID 是 search-one-way 端点的必填参数
 */
async function searchAirport(
  query: string,
  apiKey: string,
): Promise<AirportInfo | null> {
  const url = new URL(AUTO_COMPLETE_URL);
  url.searchParams.set('query', query);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-rapidapi-host': API_HOST,
        'x-rapidapi-key': apiKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    console.log('[RapidAdapter] searchAirport HTTP Status:', response.status);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(
        `[RapidAdapter] searchAirport 失败: HTTP ${response.status} | body: ${body.substring(0, 300)}`,
      );
      return null;
    }

    const json = await response.json();
    console.log(
      '[RapidAdapter] searchAirport 响应:',
      JSON.stringify(json).substring(0, 500),
    );

    // 适配多种响应结构
    const results: any[] =
      json?.data ?? json?.results ?? (Array.isArray(json) ? json : []);

    if (!Array.isArray(results) || results.length === 0) {
      console.warn('[RapidAdapter] searchAirport 未找到结果:', query);
      return null;
    }

    const first = results[0];

    // 尝试多种路径提取 skyId 和 entityId
    const skyId =
      first.skyId ??
      first.navigation?.relevantFlightParams?.skyId ??
      first.presentation?.skyId ??
      '';
    const entityId =
      first.entityId ??
      first.navigation?.relevantFlightParams?.entityId ??
      first.presentation?.entityId ??
      '';
    const cityName =
      first.presentation?.title ?? first.name ?? first.cityName ?? '';

    if (!skyId || !entityId) {
      console.warn(
        `[RapidAdapter] searchAirport 结果缺少 skyId/entityId:`,
        JSON.stringify(first).substring(0, 300),
      );
      return null;
    }

    console.log(
      `[RapidAdapter] searchAirport 匹配: query=${query} → skyId=${skyId}, entityId=${entityId}, cityName=${cityName}`,
    );
    return { skyId, entityId, cityName };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[RapidAdapter] searchAirport 超时（8s）:', query);
    } else {
      console.warn('[RapidAdapter] searchAirport 异常:', error.message || error);
    }
    return null;
  }
}

// ─── 响应解析 ───

/**
 * 解析 RapidAPI Flights Sky 响应，适配多种常见结构
 */
function parseResponse(
  json: any,
  departureCity: string,
  arrivalCity: string,
): FlightResult[] {
  const results: FlightResult[] = [];

  // 适配多种嵌套路径
  const itineraries: any[] =
    json?.data?.itineraries ??
    json?.itineraries ??
    json?.data?.flights ??
    [];

  if (!Array.isArray(itineraries) || itineraries.length === 0) {
    console.log('[RapidAdapter] 响应中未找到 itineraries，顶层 keys:', Object.keys(json || {}));
    // 打印错误详情以便排查
    if (json?.errors) {
      console.log('[RapidAdapter] API错误详情:', JSON.stringify(json.errors, null, 2));
    }
    if (json?.message) {
      console.log('[RapidAdapter] API消息:', JSON.stringify(json.message, null, 2));
    }
    return [];
  }

  for (let i = 0; i < itineraries.length; i++) {
    try {
      const itinerary = itineraries[i];
      const leg = itinerary.legs?.[0] ?? itinerary;

      // 价格
      const rawPrice = itinerary.price?.raw
        ?? itinerary.price
        ?? leg.price?.raw
        ?? leg.price
        ?? 0;
      const price = typeof rawPrice === 'number' ? rawPrice : 0;

      // 航空公司
      const carrier = leg.carriers?.marketing?.[0]
        ?? leg.carriers?.[0]
        ?? {};
      const airline = carrier.name || carrier.code || '未知';

      // 机场代码
      const originCode: string = leg.origin?.id ?? '';
      const destCode: string = leg.destination?.id ?? '';

      // 城市名：参数传入的中文城市名优先
      const depCity = /[\u4e00-\u9fa5]/.test(departureCity)
        ? departureCity
        : (originCode ? iataToCity(originCode) : departureCity);
      const arrCity = /[\u4e00-\u9fa5]/.test(arrivalCity)
        ? arrivalCity
        : (destCode ? iataToCity(destCode) : arrivalCity);

      // 时间
      const departureTime = toHHMM(leg.departure ?? '');
      const arrivalTime = toHHMM(leg.arrival ?? '');

      // 时长
      const durationMin: number = leg.durationInMinutes ?? 0;

      // 经停数
      const stops: number = leg.stopCount ?? 0;

      results.push({
        flightNo: extractFlightNo(leg, i + 1),
        airline,
        departureCity: depCity,
        arrivalCity: arrCity,
        departureAirport: originCode ? iataToAirportName(originCode) : originCode,
        arrivalAirport: destCode ? iataToAirportName(destCode) : destCode,
        departureTime,
        arrivalTime,
        duration: formatDuration(durationMin),
        price,
        cabinClass: 'economy',
        aircraft: '',
        stops,
        source: 'rapid',
        currency: 'CNY',
      });
    } catch (err) {
      console.warn(`[RapidAdapter] 解析第 ${i + 1} 条航班数据出错:`, err);
    }
  }

  return results;
}

// ─── 主函数 ───

/**
 * 从 RapidAPI Flights Scraper Sky 获取航班数据
 *
 * @param params 标准航班搜索参数
 * @returns FlightResult[] 数据源标记为 'rapid'
 */
export async function fetchRapidFlights(
  params: FlightSearchParams,
): Promise<FlightResult[]> {
  const { departure_city, arrival_city, date, cabin_class } = params;

  // 检查 API Key
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    console.warn('[RapidAdapter] RAPIDAPI_KEY 未配置，跳过 RapidAPI 数据源');
    return [];
  }

  // 解析 IATA 代码
  const fromIATA = resolveIATA(departure_city);
  const toIATA = resolveIATA(arrival_city);

  if (!fromIATA || !toIATA) {
    console.warn(
      `[RapidAdapter] 无法解析城市代码: ${departure_city}(${fromIATA ?? 'null'}) → ${arrival_city}(${toIATA ?? 'null'})`,
    );
    return [];
  }

  console.log(`[RapidAdapter] 查询: ${departure_city}(${fromIATA}) → ${arrival_city}(${toIATA}), ${date}`);

  // ── 步骤1: 通过 auto-complete 获取 skyId 和 entityId ──
  const [originInfo, destInfo] = await Promise.all([
    searchAirport(departure_city, apiKey),
    searchAirport(arrival_city, apiKey),
  ]);

  // ── 步骤2: 构建请求 URL ──
  const url = new URL(SEARCH_ONE_WAY_URL);

  if (originInfo && destInfo) {
    // 使用 auto-complete 返回的 skyId 和 entityId
    url.searchParams.set('originSkyId', originInfo.skyId);
    url.searchParams.set('destinationSkyId', destInfo.skyId);
    url.searchParams.set('originEntityId', originInfo.entityId);
    url.searchParams.set('destinationEntityId', destInfo.entityId);
    url.searchParams.set('date', date);
    console.log(
      `[RapidAdapter] 使用 auto-complete 参数: originSkyId=${originInfo.skyId}, originEntityId=${originInfo.entityId}, destSkyId=${destInfo.skyId}, destEntityId=${destInfo.entityId}`,
    );
  } else {
    // 降级：直接使用 IATA 码作为 fromEntityId/toEntityId
    url.searchParams.set('fromEntityId', fromIATA);
    url.searchParams.set('toEntityId', toIATA);
    url.searchParams.set('departDate', date);
    console.log(
      `[RapidAdapter] auto-complete 失败，降级使用 IATA 码: fromEntityId=${fromIATA}, toEntityId=${toIATA}`,
    );
  }

  url.searchParams.set('adults', '1');
  url.searchParams.set('currency', 'CNY');
  url.searchParams.set('market', 'zh-CN');
  url.searchParams.set('countryCode', 'CN');
  if (cabin_class) {
    url.searchParams.set('cabinClass', cabin_class);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-rapidapi-host': API_HOST,
        'x-rapidapi-key': apiKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    // ── HTTP 状态码日志 ──
    console.log('[RapidAdapter] HTTP Status:', response.status, response.statusText);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error(
        `[RapidAdapter] HTTP 错误: ${response.status} ${response.statusText} | body: ${errorBody.substring(0, 500)}`,
      );
      return [];
    }

    const json = await response.json();
    console.log('[RapidAdapter] 响应状态:', json.status, '| 顶层 keys:', Object.keys(json));
    console.log('[RapidAdapter] 完整响应体:', JSON.stringify(json).substring(0, 500));

    // 如果响应包含错误字段，打印详细错误信息
    if (json?.errors) {
      console.log('[RapidAdapter] API错误详情:', JSON.stringify(json.errors, null, 2));
    }
    if (json?.message) {
      console.log('[RapidAdapter] API消息:', JSON.stringify(json.message, null, 2));
    }

    const flights = parseResponse(json, departure_city, arrival_city);
    console.log(`[RapidAdapter] 解析到 ${flights.length} 趟航班`);

    return flights;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[RapidAdapter] 请求超时（15s）');
    } else {
      console.error('[RapidAdapter] 请求异常:', error.message || error);
    }
    return [];
  }
}

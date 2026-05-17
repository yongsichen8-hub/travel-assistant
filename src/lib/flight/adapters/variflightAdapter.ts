/**
 * 飞常准（VariFlight）MCP 航班时刻表适配器
 *
 * 端点: POST https://open-al.variflight.com/mcp
 * 协议: JSON-RPC 2.0
 * 认证: Bearer Token
 *
 * 飞常准提供企业级航班时刻表数据，不提供价格。
 * 价格由飞猪辅助补价。
 */

import type { FlightSearchParams, FlightResult } from '../types';
import { iataToAirportName } from '../airports';

// ─── 常量 ───

const VARIFLIGHT_API_KEY = process.env.VARIFLIGHT_API_KEY || '';
const API_ENDPOINT = 'https://open-al.variflight.com/mcp';
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
 * 构造 MCP JSON-RPC 2.0 请求体
 */
function buildRequestBody(dep: string, arr: string, date: string): string {
  const payload = {
    jsonrpc: '2.0',
    id: String(Date.now()),
    method: 'tools/call',
    params: {
      name: 'searchFlightsByDepArr',
      arguments: {
        dep,       // IATA 三字码，如 PEK
        arr,       // IATA 三字码，如 CAN
        date,      // YYYY-MM-DD 格式（保留连字符）
      },
    },
  };
  return JSON.stringify(payload);
}

/**
 * 构造请求 headers
 */
function buildHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${VARIFLIGHT_API_KEY}`,
  };
}

// ─── 响应类型 ───

/** MCP JSON-RPC 响应顶层结构 */
interface McpRpcResponse {
  jsonrpc?: string;
  id?: string;
  result?: {
    content?: Array<{ type?: string; text?: string }>;
  };
  error?: {
    code?: number;
    message?: string;
  };
}

// ─── 主函数 ───

/**
 * 从飞常准 MCP 获取航班时刻表数据
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
  // MCP 日期格式：YYYY-MM-DD（保留连字符，与 REST API 的 YYYYMMDD 不同）
  const date = params.date;

  // 构造 MCP 请求
  const body = buildRequestBody(dep, arr, date);
  const headers = buildHeaders();

  console.log(`[VariFlight] 请求航班: ${params.departure_city}(${dep}) → ${params.arrival_city}(${arr}), 日期: ${date}`);
  console.log('[VariFlight] Request URL:', API_ENDPOINT);
  console.log('[VariFlight] Request Headers:', JSON.stringify(headers, null, 2));
  console.log('[VariFlight] Request Body:', body);

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    console.log(`[VariFlight] HTTP Status: ${response.status}`);
    const responseText = await response.text();
    console.log('[VariFlight] Response Body:', responseText.substring(0, 500));

    // HTTP 层面错误
    if (!response.ok) {
      console.error(`[VariFlight] HTTP 错误: ${response.status} | body: ${responseText.substring(0, 300)}`);
      return [];
    }

    // 解析 JSON-RPC 响应
    let rpcResult: McpRpcResponse;
    try {
      rpcResult = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('[VariFlight] JSON解析失败:', parseErr, '原始响应:', responseText.substring(0, 500));
      return [];
    }

    // 检查 JSON-RPC 错误
    if (rpcResult.error) {
      console.error('[VariFlight] JSON-RPC错误:', JSON.stringify(rpcResult.error));
      return [];
    }

    // 提取 content 中的 text 字段（MCP 返回格式：result.content[0].text）
    const escapedText = rpcResult.result?.content?.[0]?.text;
    if (!escapedText) {
      console.error('[VariFlight] 无法获取 result.content[0].text');
      return [];
    }

    // 二次解析：content.text 是 JSON 字符串，需要 JSON.parse 得到航班数组
    let flightsRaw: any;
    try {
      flightsRaw = JSON.parse(escapedText);
      // 如果解析结果仍然是字符串，说明还需要再解析一次
      if (typeof flightsRaw === 'string') {
        flightsRaw = JSON.parse(flightsRaw);
      }
    } catch (parseErr) {
      console.error('[VariFlight] content.text 二次解析失败:', parseErr, 'text:', escapedText.substring(0, 500));
      return [];
    }

    // 兼容多种响应结构：直接数组、data 数组、flightList 数组
    const flights: any[] = Array.isArray(flightsRaw)
      ? flightsRaw
      : flightsRaw?.data || flightsRaw?.flightList || [];

    if (!Array.isArray(flights) || flights.length === 0) {
      console.log(`[VariFlight] 无航班数据，原始响应结构 keys: ${flightsRaw ? Object.keys(flightsRaw) : 'null'}`);
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

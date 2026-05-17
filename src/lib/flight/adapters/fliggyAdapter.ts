/**
 * 飞猪 MCP 适配器
 *
 * 参照 FlyClaw sources/fliggy_mcp.py 实现
 * 端点: POST https://flyai.open.fliggy.com/mcp
 * 协议: JSON-RPC 2.0
 * 认证: HMAC-SHA256 签名
 */

import * as crypto from 'crypto';
import * as zlib from 'zlib';
import type { FlightSearchParams, FlightResult, FlightSegment } from '../types';
import { iataToAirportName } from '../airports';

// ─── 常量 ───

const API_ENDPOINT = 'https://flyai.open.fliggy.com/mcp';
const TIMEOUT_MS = 15_000;

/** 来自 @fly-ai/flyai-cli v1.0.6 的公开密钥 */
const DEFAULT_API_KEY = 'sk-faRn8Kp2QzXvLm9YtA4EjHcWbS7oUdG5iF3xNqV6rZ';
const DEFAULT_SIGN_SECRET = 'XSbdYnucPARDc9knhD8+X6hxdD1Nh6ZGI6Hadg25kBw=';

// ─── 签名计算 ───

/**
 * 签名生成引擎 (严格对齐 Python hashlib)
 *
 * sign_string = "POST\n/mcp\n{timestamp}\n{nonce}\n{sha256_of_body}\n{sha256_of_auth_header}"
 * signature = HMAC-SHA256(sign_secret, sign_string) → hex
 */
function generateSignature(bodyStr: string, timestamp: string, nonce: string): string {
  const method = 'POST';
  const path = '/mcp';
  const authHeader = `Bearer ${DEFAULT_API_KEY}`;

  const bodyHash = crypto.createHash('sha256').update(bodyStr, 'utf8').digest('hex');
  const authHash = crypto.createHash('sha256').update(authHeader, 'utf8').digest('hex');

  const payload = `${method}\n${path}\n${timestamp}\n${nonce}\n${bodyHash}\n${authHash}`;

  return crypto.createHmac('sha256', DEFAULT_SIGN_SECRET).update(payload, 'utf8').digest('base64url').replace(/=+$/, '');
}

// ─── 设备指纹 ───

/**
 * 设备指纹引擎 (严格对齐 Python AES-GCM)
 *
 * 1. JSON.stringify({ platform, arch, nodeVersion })
 * 2. gzip 压缩
 * 3. AES-256-GCM 加密 (key = SHA256(DEFAULT_SIGN_SECRET), iv = random 12字节)
 * 4. 拼接 0x01版本字节 + iv + ciphertext + authTag
 * 5. Base64 编码
 */
function generateDeviceContext(): string {
  const ctxInfo = { platform: "macOS", arch: "arm64", nodeVersion: "v18.17.0" };
  const ctxStr = JSON.stringify(ctxInfo);
  const gzipped = zlib.gzipSync(ctxStr);

  const keyBuffer = crypto.createHash('sha256').update(DEFAULT_SIGN_SECRET, 'utf8').digest();
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  const ciphertext = Buffer.concat([cipher.update(gzipped), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const versionByte = Buffer.from([0x01]);
  const finalBuffer = Buffer.concat([versionByte, iv, ciphertext, authTag]);

  return finalBuffer.toString('base64');
}

// ─── 请求构造 ───

/**
 * 构造请求 headers
 */
function buildHeaders(body: string): Record<string, string> {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const signature = generateSignature(body, timestamp, nonce);
  const deviceCtx = generateDeviceContext();

  return {
    'Authorization': `Bearer ${DEFAULT_API_KEY}`,
    'Content-Type': 'application/json; charset=utf-8',
    'x-flyai-ts': timestamp,
    'x-flyai-nonce': nonce,
    'x-flyai-sign': signature,
    'x-flyai-sign-ver': '7',
    'x-flyai-sign-alg': 'hmac-sha256',
    'x-ff-ctx': deviceCtx,
  };
}

/**
 * 构造 JSON-RPC 2.0 请求体（含分页页码）
 */
function buildRequestBody(origin: string, destination: string, depDate: string, page: number): string {
  const payload = {
    jsonrpc: '2.0',
    id: Date.now().toString(),
    method: 'tools/call',
    params: {
      name: 'search_flight',
      arguments: {
        origin,
        destination,
        depDate,
        limit: 100, // 向飞猪索要完整大盘数据
        page,       // 分页页码
      },
    },
  };
  return JSON.stringify(payload);
}

// ─── 响应解析 ───

/** 飞猪 API 返回的 segment 结构 */
interface FliggySegment {
  marketingTransportNo: string;
  marketingTransportName: string;
  depStationCode: string;
  arrStationCode: string;
  depCityName: string;
  arrCityName: string;
  depDateTime: string;
  arrDateTime: string;
  duration: number;
  seatClassName: string;
}

/** 飞猪 API 返回的 journey 结构 */
interface FliggyJourney {
  totalDuration: number;
  segments: FliggySegment[];
}

/** 飞猪 API 返回的 item 结构 */
interface FliggyItem {
  ticketPrice: number;
  journeys: FliggyJourney[];
}

/** 飞猪 API 返回的顶层结构 */
interface FliggyResponse {
  result?: {
    content?: Array<{ text?: string }>;
  };
  error?: {
    code?: number;
    message?: string;
  };
}

/**
 * 从日期时间字符串提取 HH:mm
 * "2026-05-20 07:10:00" → "07:10"
 */
function extractTime(dateTimeStr: string): string {
  if (!dateTimeStr) return '';
  // 格式: "YYYY-MM-DD HH:mm:ss"
  const parts = dateTimeStr.split(' ');
  if (parts.length < 2) return '';
  const timePart = parts[1];
  return timePart.substring(0, 5); // "HH:mm"
}

/**
 * 将总分钟数转为 "Xh Ymin" 格式
 */
function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return '';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

/**
 * 将飞猪 item 映射为 FlightResult
 */
function mapItemToFlightResult(item: FliggyItem): FlightResult | null {
  try {
    const journey = item.journeys?.[0];
    if (!journey || !journey.segments || journey.segments.length === 0) {
      return null;
    }

    const segments = journey.segments;
    const firstSeg = segments[0];
    const lastSeg = segments[segments.length - 1];

    // 构建多段 segments 详情
    const flightSegments: FlightSegment[] = segments.map((seg) => ({
      flightNo: seg.marketingTransportNo,
      departureAirport: iataToAirportName(seg.depStationCode),
      arrivalAirport: iataToAirportName(seg.arrStationCode),
      departureTime: extractTime(seg.depDateTime),
      arrivalTime: extractTime(seg.arrDateTime),
      duration: seg.duration,
    }));

    return {
      flightNo: firstSeg.marketingTransportNo,
      airline: firstSeg.marketingTransportName,
      departureCity: firstSeg.depCityName,
      arrivalCity: lastSeg.arrCityName,
      departureAirport: iataToAirportName(firstSeg.depStationCode),
      arrivalAirport: iataToAirportName(lastSeg.arrStationCode),
      departureTime: extractTime(firstSeg.depDateTime),
      arrivalTime: extractTime(lastSeg.arrDateTime),
      duration: formatDuration(journey.totalDuration),
      price: item.ticketPrice,
      cabinClass: firstSeg.seatClassName,
      aircraft: '', // FR24 前端异步补充
      stops: segments.length - 1,
      source: 'fliggy',
      currency: 'CNY' as const,
      segments: segments.length > 1 ? flightSegments : undefined,
    };
  } catch (err) {
    console.error('[FliggyAdapter] 映射单条航班数据失败:', err);
    return null;
  }
}

// ─── 主函数 ───

/**
 * 通过飞猪 MCP 搜索航班（分页循环，最多5页共50条）
 *
 * @param params 航班搜索参数
 * @returns FlightResult[] 航班结果数组，失败时返回空数组
 */
export async function fetchFliggyFlights(params: FlightSearchParams): Promise<FlightResult[]> {
  const allResults: FlightResult[] = [];
  const maxPages = 5; // 最多请求5页，共50条

  for (let page = 1; page <= maxPages; page++) {
    const pageResults = await fetchFliggyFlightsPage(params, page);
    allResults.push(...pageResults);

    console.log(`[FliggyAdapter] 第${page}页获取到 ${pageResults.length} 趟航班`);

    // 如果本页返回少于10条，说明没有更多数据了
    if (pageResults.length < 10) break;

    // 请求间隔避免限流
    if (page < maxPages) await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[FliggyAdapter] 分页合计获取到 ${allResults.length} 趟航班`);
  return allResults;
}

/**
 * 单页飞猪 MCP 请求
 */
async function fetchFliggyFlightsPage(params: FlightSearchParams, page: number): Promise<FlightResult[]> {
  const { departure_city, arrival_city, date } = params;
  try {
    // 构造请求体（含分页页码）
    const body = buildRequestBody(departure_city, arrival_city, date, page);
    const headers = buildHeaders(body);

    console.log(`[FliggyAdapter] 第${page}页请求航班: ${departure_city} → ${arrival_city}, 日期: ${date}`);
    console.log('[FliggyAdapter] Request Body:', body);
    console.log('[FliggyAdapter] Request URL:', API_ENDPOINT);

    // 发起请求，15秒超时
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    console.log('[FliggyAdapter] Response Status:', response.status);
    const responseText = await response.text();
    console.log('[FliggyAdapter] Response Body:', responseText.substring(0, 500));

    // 签名错误 (401)
    if (response.status === 401) {
      console.error('[FliggyAdapter] 签名验证失败 (401):', responseText);
      return [];
    }

    if (!response.ok) {
      console.error(`[FliggyAdapter] API请求失败 - 状态码: ${response.status}`, responseText);
      return [];
    }

    // 解析响应
    let rpcResult: FliggyResponse;

    try {
      rpcResult = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('[FliggyAdapter] JSON解析失败:', parseErr, '原始响应:', responseText.substring(0, 500));
      return [];
    }

    // 检查 JSON-RPC 错误
    if (rpcResult.error) {
      console.error('[FliggyAdapter] JSON-RPC错误:', JSON.stringify(rpcResult.error));
      return [];
    }

    // 提取 content 中的 text 字段（转义的 JSON 字符串）
    const escapedText = rpcResult.result?.content?.[0]?.text;
    if (!escapedText) {
      console.error('[FliggyAdapter] 无法获取 content[0].text');
      return [];
    }

    // 核心修复：二次解析，将转义字符串还原为真正的飞猪数据对象
    let innerData: any;
    try {
      innerData = JSON.parse(escapedText);
      // 如果解析结果仍然是字符串，说明还需要再解析一次
      if (typeof innerData === 'string') {
        innerData = JSON.parse(innerData);
      }
    } catch (parseErr) {
      console.error('[FliggyAdapter] content.text 二次解析失败:', parseErr, 'text:', escapedText.substring(0, 500));
      return [];
    }

    // 获取真实的航班列表（兼容 data.itemList 和直接 itemList 两种路径）
    const itemList: FliggyItem[] = innerData?.data?.itemList || innerData?.itemList;
    if (!itemList || itemList.length === 0) {
      console.log('[FliggyAdapter] 二次解析成功，但 itemList 为空');
      return [];
    }

    console.log(`[FliggyAdapter] 第${page}页获取到 ${itemList.length} 趟原始航班数据`);

    // 映射为 FlightResult[]
    const flights: FlightResult[] = [];
    for (const item of itemList) {
      const flight = mapItemToFlightResult(item);
      if (flight) {
        flights.push(flight);
      }
    }

    console.log(`[FliggyAdapter] 第${page}页成功映射 ${flights.length} 条航班`);
    return flights;
  } catch (err) {
    // 网络错误 / 超时
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[FliggyAdapter] 请求超时 (15s)');
    } else {
      console.error('[FliggyAdapter] 请求异常:', err);
    }
    return [];
  }
}

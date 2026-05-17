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
 * 计算 HMAC-SHA256 签名
 *
 * sign_string = "POST\n/mcp\n{timestamp}\n{nonce}\n{sha256_of_body}\n{sha256_of_auth_header}\n"
 * signature = HMAC-SHA256(base64decode(sign_secret), sign_string)
 * result = base64url_encode(signature) 去除末尾 '='
 */
function computeSignature(
  body: string,
  timestamp: string,
  nonce: string,
  apiKey: string,
  signSecret: string,
): string {
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
  const authHeader = `Bearer ${apiKey}`;
  const authHash = crypto.createHash('sha256').update(authHeader).digest('hex');

  const signString = `POST\n/mcp\n${timestamp}\n${nonce}\n${bodyHash}\n${authHash}\n`;

  const secretBuf = Buffer.from(signSecret, 'base64');
  const signature = crypto
    .createHmac('sha256', secretBuf)
    .update(signString)
    .digest();

  // base64url 编码，去除填充
  return signature.toString('base64url').replace(/=+$/, '');
}

// ─── 设备指纹 ───

/**
 * 生成稳定的设备 ID
 * SHA256(hostname + 固定salt)
 */
function generateDeviceId(): string {
  const hostname = 'flyai-cli-worker';
  const salt = 'fliggy-mcp-device-salt-v1';
  return crypto.createHash('sha256').update(hostname + salt).digest('hex');
}

/**
 * 构造虚拟设备信息
 */
function buildDeviceInfo(): object {
  return {
    machine: {
      platform: 'linux',
      arch: 'x86_64',
      cpus: 8,
      memoryTierGB: 8,
      osType: 'linux',
      nodeVersion: 'v22.22.0',
      osReleaseMajor: '5',
    },
    fingerprint: {
      language: 'zh-CN',
      platform: 'linux',
      userAgent: 'flyai-cli/1.0.6 (Node.js v22.22.0; linux x86_64)',
      hardwareConcurrency: 8,
      deviceMemory: 8,
      clientSurface: 'cli',
      timezoneOffset: -480,
      deviceId: generateDeviceId(),
    },
  };
}

/**
 * 编码设备指纹为 x-ff-ctx header 值
 *
 * 1. JSON.stringify(deviceInfo)
 * 2. gzip 压缩
 * 3. AES-256-GCM 加密 (key = SHA256(base64decode(sign_secret)) 前32字节, iv = random 12字节)
 * 4. 拼接 iv + ciphertext + authTag
 * 5. Base64 编码
 */
function encodeDeviceFingerprint(signSecret: string): string {
  const deviceInfo = buildDeviceInfo();
  const jsonStr = JSON.stringify(deviceInfo);

  // gzip 压缩
  const compressed = zlib.gzipSync(Buffer.from(jsonStr, 'utf-8'));

  // AES-256-GCM 加密
  const key = crypto.createHash('sha256').update(Buffer.from(signSecret, 'base64')).digest().subarray(0, 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(compressed),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 16 bytes

  // iv + ciphertext + authTag
  const result = Buffer.concat([iv, encrypted, authTag]);

  return result.toString('base64');
}

// ─── 请求构造 ───

/**
 * 构造请求 headers
 */
function buildHeaders(body: string, apiKey: string, signSecret: string): Record<string, string> {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const signature = computeSignature(body, timestamp, nonce, apiKey, signSecret);

  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json, text/event-stream',
    'Authorization': `Bearer ${apiKey}`,
    'User-Agent': 'flyai-cli/1.0.6',
    'x-ttid': 'ai2c(sk.clawhub)',
    'x-flyai-ts': timestamp,
    'x-flyai-sign-ver': '7',
    'x-flyai-sign-alg': 'hmac-sha256',
    'x-flyai-nonce': nonce,
    'x-flyai-sign': signature,
    'x-ff-ctx': encodeDeviceFingerprint(signSecret),
  };
}

/**
 * 构造 JSON-RPC 2.0 请求体
 */
function buildRequestBody(origin: string, destination: string, depDate: string): string {
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
 * 通过飞猪 MCP 搜索航班
 *
 * @param params 航班搜索参数
 * @returns FlightResult[] 航班结果数组，失败时返回空数组
 */
export async function fetchFliggyFlights(params: FlightSearchParams): Promise<FlightResult[]> {
  const { departure_city, arrival_city, date } = params;
  const apiKey = DEFAULT_API_KEY;
  const signSecret = DEFAULT_SIGN_SECRET;

  try {
    // 构造请求体
    const body = buildRequestBody(departure_city, arrival_city, date);
    const headers = buildHeaders(body, apiKey, signSecret);

    console.log(`[FliggyAdapter] 请求航班: ${departure_city} → ${arrival_city}, 日期: ${date}`);
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

    // 提取 content 中的 text 字段
    const contentText = rpcResult.result?.content?.[0]?.text;
    if (!contentText) {
      console.error('[FliggyAdapter] 响应中无有效content:', responseText.substring(0, 500));
      return [];
    }

    // 解析 itemList
    let flightData: { itemList?: FliggyItem[] };
    try {
      flightData = JSON.parse(contentText);
    } catch (parseErr) {
      console.error('[FliggyAdapter] content.text JSON解析失败:', parseErr, 'text:', contentText.substring(0, 500));
      return [];
    }

    const itemList = flightData.itemList;
    if (!Array.isArray(itemList) || itemList.length === 0) {
      console.log('[FliggyAdapter] 无航班数据返回');
      return [];
    }

    console.log(`[FliggyAdapter] 获取到 ${itemList.length} 条航班数据`);

    // 映射为 FlightResult[]
    const flights: FlightResult[] = [];
    for (const item of itemList) {
      const flight = mapItemToFlightResult(item);
      if (flight) {
        flights.push(flight);
      }
    }

    console.log(`[FliggyAdapter] 成功映射 ${flights.length} 条航班`);
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
